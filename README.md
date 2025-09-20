# Toyota News RSS Collector

🚗 Toyotaの公式RSSニュースを自動収集し、Firestoreに保存するシステムです。

## 🎯 機能

- **RSS自動収集**: Toyota公式サイトからニュース取得
- **重複排除**: 高度なアルゴリズムで類似記事を統合
- **Firebase保存**: Firestoreへの自動保存
- **GitHub Actions**: クラウドでの定期実行

## 📊 収集対象

- Toyota Global News
- Toyota USA News  
- Toyota Europe News

## 🚀 実行方法

### ローカル実行
```bash
npm install
node rss-collector.js
```

### 定期実行（GitHub Actions）
- 4時間毎に自動実行
- 手動実行も可能

## 📈 ステータス

![RSS Collection](https://github.com/あなたのユーザー名/toyota-news-collector/workflows/🚗%20Toyota%20RSS%20Collection/badge.svg)

## 🛠️ 開発状況

- [x] RSS収集機能
- [x] Firebase連携
- [x] 重複検出システム
- [x] GitHub Actions設定
- [ ] Web API
- [ ] ダッシュボード

---
