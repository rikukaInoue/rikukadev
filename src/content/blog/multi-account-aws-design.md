---
title: "マルチアカウントAWSにおける社内サービス連携の設計 — TGW・PrivateLink・Route53の使い分けと落とし穴"
date: 2026-04-20
tags: ["AWS", "マルチアカウント", "ネットワーク", "TGW", "PrivateLink", "Route53", "IPAM"]
description: "AWS マルチアカウント環境でのサービス間接続方式（TGW・PrivateLink・VPC Peering・インターネット経由）をコスト計算付きで比較。Route53 Private Hosted Zone の落とし穴、IPAM の実務的な使い方、中央 egress 集約の設計判断まで整理します。"
---

## はじめに

マルチアカウント AWS を運用していると、「アカウント A のサービスからアカウント B の API を呼びたい」という場面が頻繁に出てきます。このとき、TGW（Transit Gateway）を使うのか、PrivateLink を使うのか、あるいはインターネット経由でいいのか——判断を誤ると月額コストが数倍になったり、DNS が通らなくて本番障害になったりします。

この記事では、接続方式の選択基準をコスト計算付きで示し、Route53 や IPAM まわりの「知らないとハマる」ポイントを整理します。

## サービス間接続方式の選択

まず、AWS アカウント間（VPC 間）でサービスを繋ぐ方式を整理します。

| 方式 | 概要 | 向いているケース |
|------|------|----------------|
| **インターネット経由** | パブリック IP で通信。NAT GW or EIP が必要 | 外部 SaaS 連携、低トラフィック |
| **VPC Peering** | 2 VPC を直結。推移的ルーティング不可 | 固定の 2 VPC 間通信 |
| **Transit Gateway (TGW)** | ハブ&スポーク型。多対多の接続 | 3+ VPC の汎用接続、中央 egress |
| **PrivateLink** | サービス単位の公開。NLB 経由 | 特定 API の共有、SaaS 型公開 |

### 「インターネット経由だけど AWS 内通信」の罠

Route53 の **Public Hosted Zone** で名前解決して、実際の通信が AWS リージョン内で閉じていても、AWS の課金上は**インターネット通信扱い**になります。物理経路と論理的扱いは別です。

- **egress 料金**: $0.09/GB が課金される
- **セキュリティ**: パブリック IP を経由するので、Security Group だけでなく ACL やWAF の考慮が必要
- **可用性**: インターネットパスの障害に依存する

「AWS 内だからタダでしょ？」は危険な誤解です。

## 実際のコスト計算

### 前提料金（US 東部基準）

| リソース | 料金 |
|---------|------|
| TGW アタッチメント | $0.05/hr |
| TGW データ処理 | $0.02/GB |
| インターネット egress | $0.09/GB（月 100GB 無料、10TB 以降は段階的に低下） |
| NAT Gateway | $0.045/hr + $0.045/GB |
| PrivateLink Interface Endpoint | $0.01/hr/AZ + $0.01/GB |

### シナリオ 1: 2 アカウント間

TGW は**両側にアタッチメントが必要**なので、固定費が 2 × $0.05 × 720h = **$72/月** から始まります。PrivateLink は 1AZ の場合 $0.01 × 720h = **$7.2/月**。

| 月間データ量 | Internet (egress のみ) | Internet + NAT GW | TGW | PrivateLink (1AZ) |
|------------|----------------------|-------------------|-----|-------------------|
| 10 GB | $0 (無料枠内) | $32.40 + $0.45 = $32.85 | $72.20 | $7.30 |
| 100 GB | $0 (無料枠内) | $32.40 + $4.50 = $36.90 | $74.00 | $8.20 |
| 500 GB | $36.00 | $32.40 + $22.50 = $54.90 | $82.00 | $12.20 |
| 1 TB | $88.47 | $32.40 + $46.08 = $78.48 | $92.40 | $17.40 |
| 5 TB | $450.35 | $32.40 + $230.40 = $262.80 | $174.00 | $58.40 |
| 10 TB | $891.69 | $32.40 + $460.80 = $493.20 | $276.00 | $107.20 |

※ Internet (egress のみ) は NAT GW を既存流用する前提、月 100GB の無料枠を適用
※ Internet + NAT GW は NAT GW の固定費 + データ処理費を加算

**損益分岐点:**
- TGW vs Internet（NAT 込み）: 約 **1 TB/月** で逆転
- PrivateLink は**全域で最安**

**結論: 2 アカウント・サービス単位の連携なら PrivateLink が圧倒的に強い。**

### シナリオ 2: 5 VPC（5 アカウント）に拡張

TGW の固定費は 5 アタッチメント × $36/月 = **$180/月**。

PrivateLink には 2 つのトポロジがあります。

- **ハブ型**: 共有サービス 1 つを 4 VPC が利用 → エンドポイント 4 個 → 固定費 $28.80/月
- **メッシュ型**: 全 VPC が相互接続 → 5×4 = 20 エンドポイント → 固定費 $144/月

| 月間データ量 | Internet (egress) | TGW | PrivateLink ハブ | PrivateLink メッシュ |
|------------|-------------------|-----|-----------------|-------------------|
| 100 GB | $0 | $182.00 | $29.80 | $145.00 |
| 500 GB | $36.00 | $190.00 | $33.80 | $149.00 |
| 1 TB | $88.47 | $200.40 | $39.00 | $154.20 |
| 5 TB | $450.35 | $280.00 | $79.00 | $194.00 |
| 10 TB | $891.69 | $380.00 | $129.00 | $244.00 |

※ 全 VPC 間で均等にトラフィックが分散する前提

**TGW vs Internet の損益分岐点は約 225 GB/月** まで下がります（VPC 数が増えると TGW の固定費分散効果が出るため）。

**使い分け:**
- 共有サービスを複数 VPC から利用する → **PrivateLink ハブ型**
- 全 VPC がフラットに相互接続する → **TGW**

## NAT Gateway の扱い

NAT GW は「private サブネットからインターネットに出るための踏み台」であって、通信そのものが NAT を要求するわけではありません。

### NAT GW を使わない代替手段

| 方式 | 内容 | 向いているケース |
|------|------|----------------|
| **Public Subnet + EIP** | Lambda/ECS を public subnet に配置 | シンプルな構成、少数のサービス |
| **IPv6 + Egress-Only IGW** | IPv6 で外に出る | IPv6 対応サービス |
| **既存 NAT GW の流用** | 他の用途で既に存在する NAT GW を使う | 多くの企業環境 |

多くの企業環境では、外部 API 連携や OS パッチ取得のために**既存の NAT GW を持っている**ので、サービス間通信での増分コストは **$0.045/GB のデータ処理料金のみ**というのが実態です。NAT GW の固定費（$32.40/月）は既に支払っているケースが多い。

## TGW で中央 egress 集約

### 分散配置 vs 中央集約

| | 分散（各 VPC に NAT GW） | 集約（中央 egress VPC） |
|---|---|---|
| NAT GW 固定費 | $32.40 × VPC 数 | $32.40 × AZ 数（1 VPC） |
| データ処理 | NAT GW: $0.045/GB | NAT GW: $0.045/GB + TGW: $0.02/GB |
| Network Firewall | 各 VPC に配置（高コスト） | 1 箇所に集約 |
| EIP 数 | VPC 数 × AZ 数 | AZ 数のみ |
| 運用 | 分散して監視 | 一元管理 |

5 VPC × 2 AZ の場合:
- **分散**: NAT GW 固定費 $32.40 × 10 = **$324/月**
- **集約**: NAT GW 固定費 $32.40 × 2 = $64.80 + TGW $180 = **$244.80/月**

データ処理量が少ない場合は集約の方が安くなります。ただし、集約の本当の価値はコストではなく**運用の一元化**です。

### 集約構成が正当化される理由

- **Network Firewall / WAF / DNS フィルタの一元管理** — セキュリティポリシーを 1 箇所で制御
- **EIP 節約** — 相手先の allowlist 運用で EIP 数を最小化
- **運用監視の集約** — egress のトラフィック監視・異常検知が 1 箇所で完結
- **VPC 間通信と egress が同じ基盤に乗る** — TGW を導入すれば VPC 間も egress も同じインフラ

## マルチアカウント設計原則

ここまでのネットワーク設計を含め、マルチアカウント環境の設計原則を整理します。

### アカウント分離

- **プロダクト × 環境** の粒度で分離（`product-a-prod`, `product-a-dev`）
- 共通機能（ネットワーク、セキュリティ、ログ、DNS）は**専用アカウント**に集約
- Organizations + **Control Tower** + **Account Factory** で標準化

### ネットワーク

- 中央 **Network アカウント**に TGW を配置、**RAM（Resource Access Manager）**で全アカウントに共有
- **TGW Route Table** で環境分離（prod ↔ dev を通さない等）
- 接続方式の選択フロー:

```
サービスを他のVPCに公開したい？
├── Yes, 特定のAPI/サービス → PrivateLink
├── Yes, 汎用的な接続（3+ VPC） → TGW
├── Yes, 2VPC固定 → VPC Peering
└── 外部サービス連携 → Internet
```

### CIDR 設計

- **IPAM で集中管理**（後述）
- VPC 間で CIDR が重複しないことを保証
- `/16` 単位でリージョン・環境に割り当て、`/24` 単位で VPC に配布

### DNS 戦略

- **Route53 Private Hosted Zone を中央管理**（Network アカウント）
- **Route53 Profiles** で全 spoke アカウントに配布（後述）
- 命名規則: `{service}.{env}.internal`（例: `auth.prod.internal`）

### セキュリティ・ログ

- **CloudTrail**: Organizations 証跡で全アカウント一元収集
- **GuardDuty**: Delegated Admin で集約
- **Security Hub**: 全アカウントのコンプライアンスを一元管理
- **IAM Identity Center**: SSO で全アカウントへのアクセスを管理

### 運用

- **Cost Allocation Tags**: `Product`, `Environment`, `Team` を必須タグに
- **IaC 強制**: Service Control Policy（SCP）でコンソール直接操作を制限、Terraform/CDK を標準化

## IPAM の実務的な使い方

### 「CIDR の銀行」

IPAM（IP Address Manager）は、VPC の CIDR を集中管理する仕組みです。銀行に例えると：

- **Top Pool** = 金庫（会社全体の IP アドレス空間）
- **Regional Pool** = 支店（リージョンごとの割り当て）
- **Environment Pool** = 口座（prod / stg / dev それぞれの予算）
- **VPC 作成時** = 口座から引き出し（自動で空き CIDR を割り当て）

### 階層設計の例

```
Top Pool: 10.0.0.0/8
├── ap-northeast-1 Pool: 10.0.0.0/12
│   ├── prod:   10.0.0.0/14
│   ├── stg:    10.4.0.0/14
│   ├── dev:    10.8.0.0/14
│   └── shared: 10.12.0.0/14
└── us-east-1 Pool: 10.16.0.0/12
    ├── prod:   10.16.0.0/14
    └── ...
```

### セットアップ手順

1. **Organizations の管理アカウント**で IPAM を作成
2. **Delegated Admin** を Network アカウントに委任
3. **Pool 階層**を作成（Top → Region → Environment）
4. **RAM** で Environment Pool を各アカウントに共有
5. **Allocation Rule** で CIDR サイズの上限・下限を設定

### Terraform からの利用例

```hcl
resource "aws_vpc" "main" {
  ipv4_ipam_pool_id   = data.aws_vpc_ipam_pool.prod.id
  ipv4_netmask_length = 24  # /24 を自動割り当て
  # cidr_block は指定しない — IPAM が空きから自動で割り当てる
}
```

`cidr_block` を直接指定する代わりに、`ipv4_ipam_pool_id` + `ipv4_netmask_length` を使うことで、IPAM が空き CIDR を自動で割り当てます。

### 便利機能

| 機能 | 内容 |
|------|------|
| **Compliance Monitoring** | Pool の Allocation Rule に違反する VPC を検出 |
| **History** | CIDR の割り当て履歴を追跡（いつ誰が作ったか） |
| **Public IP Insights** | パブリック IP の使用状況を可視化 |
| **Overlap Detection** | CIDR の重複を自動検出 |
| **Auto-import** | 既存 VPC の CIDR を Pool に自動取り込み |

### 料金と注意点

- **Advanced Tier**: $0.00027/active IP/hr（Free Tier は機能が限定的）
- /24 の VPC 1 つ = 256 IP × $0.00027 × 720h = 約 **$49.77/月**
- マルチアカウントで CIDR 管理を手動でやるコスト（人件費・障害リスク）と比較すれば十分にペイする

**ハマりどころ:**
- **後からの階層変更が困難** — Pool 構造の設計は最初が肝心
- **既存 VPC の移行** — Auto-import はできるが、CIDR が Pool の範囲外だと取り込めない

## Route53 Private Hosted Zone の落とし穴

### TGW で繋いでも PHZ は自動では見えない

これが最大の落とし穴です。TGW で L3（ルーティング）レベルの接続を確立しても、**DNS 解決は別レイヤー**です。

アカウント A に `auth.prod.internal` の PHZ を作り、TGW でアカウント B と繋いでも、アカウント B の EC2 から `auth.prod.internal` は**名前解決できません**。

### 「見える」の 2 つの意味

| | 意味 | クロスアカウント |
|---|---|---|
| **(A) PHZ リソース自体が見える** | コンソールや API で PHZ を管理できる | 所有アカウントのみ。RAM で共有不可 |
| **(B) VPC のリゾルバがレコード解決できる** | `dig auth.prod.internal` が応答を返す | クロスアカウント可能（要設定） |

(B) を実現するには明示的な設定が必要です。

### 解決策 3 つ

#### 1. VPC Association の 2 段階手順

```bash
# アカウント A（PHZ 所有者）: 認可を作成
aws route53 create-vpc-association-authorization \
  --hosted-zone-id Z1234567890 \
  --vpc VPCRegion=ap-northeast-1,VPCId=vpc-aaaa1111

# アカウント B（VPC 所有者）: 関連付けを実行
aws route53 associate-vpc-with-hosted-zone \
  --hosted-zone-id Z1234567890 \
  --vpc VPCRegion=ap-northeast-1,VPCId=vpc-bbbb2222
```

**問題**: PHZ × VPC の組み合わせ分だけ手順が必要。10 PHZ × 20 VPC = 200 回の手順。組み合わせ爆発します。

#### 2. Route53 Resolver Rules + RAM 共有（従来型）

Network アカウントに Resolver Inbound/Outbound Endpoint を作成し、Forwarding Rule を RAM で全アカウントに共有します。

```
spoke VPC → Resolver Rule (RAM共有) → Outbound Endpoint → Inbound Endpoint → PHZ
```

設定量は減りますが、Resolver Endpoint のコスト（$0.125/hr × ENI 数）が追加されます。

#### 3. Route53 Profiles（現代の推奨）

**Route53 Profiles** は 2024 年に登場した機能で、複数の PHZ・Resolver Rule・DNS Firewall Rule Group を 1 つの Profile に束ねて、RAM で配布できます。

```
[Network アカウント]
  Profile "corp-dns"
    ├── PHZ: auth.prod.internal
    ├── PHZ: billing.prod.internal
    ├── Resolver Rule: on-prem forwarding
    └── DNS Firewall: malware domain block

     ↓ RAM で共有

[spoke アカウント]
  VPC に Profile を attach するだけ → 全 PHZ が解決可能に
```

VPC 側は `associate-profile` を 1 回実行するだけ。PHZ が増えても Profile に追加するだけで全 spoke に自動反映されます。

### 推奨アーキテクチャ

```
中央 Network アカウント（DNS ハブ）
  ├── 全サービスの PHZ を管理
  ├── Route53 Profile を作成
  ├── RAM で全アカウントに共有
  └── Resolver Endpoint（on-prem 連携がある場合）

spoke アカウント
  └── VPC に Profile を attach（1 回で完了）
```

### PHZ まわりの落とし穴まとめ

| 落とし穴 | 対策 |
|---------|------|
| TGW で繋いでも PHZ が見えない | Profiles で配布 |
| PHZ 関連付け VPC 数の quota（デフォルト 300） | Profiles なら Profile 単位で管理 |
| Profiles の対応リージョン | 主要リージョンは対応済み、確認が必要 |
| IaC 対応 | Terraform aws_route53profiles_* リソースで管理可能 |
| PHZ と Public Hosted Zone の名前衝突 | PHZ が優先される（Split Horizon DNS）。意図しない場合はゾーン名を分ける |

## まとめ

### 接続方式の選択

- **2 アカウント・サービス単位** → PrivateLink（全域で最安）
- **3+ VPC の汎用接続** → TGW（中央 egress と相乗効果）
- **2 VPC 固定** → VPC Peering（最もシンプル）
- **外部連携** → インターネット経由

### コスト判断

- TGW は固定費（$72/月〜）があるので、低トラフィックでは割高
- PrivateLink は固定費が安く（$7.2/月〜）、データ処理も $0.01/GB と最安
- NAT GW は既存流用なら増分 $0.045/GB のみ

### DNS は別レイヤー

- TGW で繋いでも PHZ は自動では見えない
- Route53 Profiles で中央管理 → RAM 配布が現代の推奨

### IPAM は最初にやる

- CIDR の重複は後から直せない
- Pool 階層の設計が最重要、後からの変更が困難
- Terraform から `ipv4_ipam_pool_id` で自動割り当て

マルチアカウント環境のネットワーク設計は「後から直す」コストが非常に高い領域です。CIDR・DNS・接続方式の 3 つは、最初のアカウント設計時に決めてください。
