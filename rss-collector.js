// rss-collector.js
// Toyota News RSS収集システム

require('dotenv').config();
const admin = require('firebase-admin');
const Parser = require('rss-parser');
const crypto = require('crypto');
const AdvancedDuplicateDetector = require('./advanced-duplicate-detection');

class ToyotaNewsCollector {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['pubDate', 'description', 'content:encoded']
      }
    });
    
    // 高度な重複検出システム
    this.duplicateDetector = new AdvancedDuplicateDetector();
    
    // Firebase初期化
    if (!admin.apps.length) {
      const serviceAccount = require('./firebase-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    
    this.db = admin.firestore();
    this.newsCollection = this.db.collection('toyota_news');
  }

  // RSS フィードのURL設定
  getRSSFeeds() {
    return [
      {
        name: 'Toyota Official News',
        url: 'https://global.toyota/en/newsroom/rss/',
        category: 'official'
      },
      {
        name: 'Toyota USA News',
        url: 'https://pressroom.toyota.com/rss/',
        category: 'usa'
      },
      {
        name: 'Toyota Europe News', 
        url: 'https://newsroom.toyota.eu/rss/',
        category: 'europe'
      }
    ];
  }

  // 記事のユニークIDを生成（基本版）
  generateArticleId(title, link) {
    return this.duplicateDetector.generateBasicId(title, link);
  }

  // 記事データの正規化
  normalizeArticle(item, feedInfo) {
    const now = new Date();
    
    return {
      id: this.generateArticleId(item.title, item.link),
      title: item.title || 'No Title',
      link: item.link || '',
      description: item.description || item.summary || '',
      content: item['content:encoded'] || item.content || '',
      publishedAt: item.pubDate ? new Date(item.pubDate) : now,
      source: feedInfo.name,
      category: feedInfo.category,
      feedUrl: feedInfo.url,
      createdAt: now,
      updatedAt: now,
      tags: this.extractTags(item.title, item.description),
      isProcessed: false
    };
  }

  // タグの抽出（キーワードベース）
  extractTags(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const tags = [];
    
    // Toyota関連キーワード
    const keywords = [
      'electric', 'hybrid', 'ev', 'battery',
      'sustainability', 'carbon', 'green',
      'technology', 'innovation', 'ai',
      'safety', 'autonomous', 'mobility',
      'manufacturing', 'production', 'factory',
      'sales', 'market', 'financial',
      'partnership', 'collaboration'
    ];
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags;
  }

  // 単一フィードの処理（重複検出強化版）
  async processFeed(feedInfo) {
    try {
      console.log(`📡 ${feedInfo.name} の RSS を取得中...`);
      
      const feed = await this.parser.parseURL(feedInfo.url);
      console.log(`📰 ${feed.items.length} 件の記事を発見`);
      
      let newArticles = 0;
      let updatedArticles = 0;
      let duplicatesFound = 0;
      
      for (const item of feed.items) {
        const article = this.normalizeArticle(item, feedInfo);
        
        // 既存記事のチェック（基本ID）
        const existingDoc = await this.newsCollection.doc(article.id).get();
        
        if (existingDoc.exists) {
          // 既存記事の更新チェック
          const existingData = existingDoc.data();
          if (existingData.title !== article.title || 
              existingData.description !== article.description) {
            article.updatedAt = new Date();
            await this.newsCollection.doc(article.id).update(article);
            updatedArticles++;
            console.log(`🔄 更新: ${article.title.substring(0, 50)}...`);
          }
        } else {
          // 高度な重複検出
          const recentArticles = await this.getRecentArticles(7); // 過去7日間
          const duplicates = await this.duplicateDetector.findDuplicates(article, recentArticles);
          
          if (duplicates.length > 0) {
            // 重複記事発見 - 既存記事を更新
            const bestMatch = duplicates[0];
            const existingArticle = recentArticles.find(a => a.id === bestMatch.existingId);
            const mergedArticle = this.duplicateDetector.mergeArticles(existingArticle, article);
            
            await this.newsCollection.doc(bestMatch.existingId).update(mergedArticle);
            duplicatesFound++;
            console.log(`🔗 重複統合: ${article.title.substring(0, 50)}...`);
            console.log(`   → 既存記事 ${bestMatch.existingId} と統合`);
          } else {
            // 新規記事の保存
            await this.newsCollection.doc(article.id).set(article);
            newArticles++;
            console.log(`✨ 新規: ${article.title.substring(0, 50)}...`);
          }
        }
      }
      
      return { 
        feed: feedInfo.name, 
        total: feed.items.length,
        new: newArticles, 
        updated: updatedArticles,
        duplicates: duplicatesFound
      };
      
    } catch (error) {
      console.error(`❌ ${feedInfo.name} の処理エラー:`, error.message);
      return { 
        feed: feedInfo.name, 
        error: error.message,
        total: 0,
        new: 0, 
        updated: 0,
        duplicates: 0
      };
    }
  }

  // 最近の記事を取得（重複検出用）
  async getRecentArticles(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const snapshot = await this.newsCollection
        .where('publishedAt', '>=', cutoffDate)
        .orderBy('publishedAt', 'desc')
        .limit(100)
        .get();
      
      const articles = [];
      snapshot.forEach(doc => {
        articles.push({ id: doc.id, ...doc.data() });
      });
      
      return articles;
    } catch (error) {
      console.error('最近記事取得エラー:', error.message);
      return [];
    }
  }

  // 全フィードの収集実行
  async collectAllFeeds() {
    const startTime = new Date();
    console.log('🚀 Toyota News RSS 収集開始');
    console.log(`⏰ 開始時刻: ${startTime.toLocaleString()}`);
    
    const feeds = this.getRSSFeeds();
    const results = [];
    
    // 各フィードを順次処理
    for (const feedInfo of feeds) {
      const result = await this.processFeed(feedInfo);
      results.push(result);
      
      // フィード間の間隔（サーバー負荷軽減）
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 実行結果の集計
    const summary = this.generateSummary(results, startTime);
    
    // 実行ログをFirestoreに保存
    await this.saveExecutionLog(summary);
    
    console.log('\n📊 収集結果サマリー:');
    console.log(summary);
    
    return summary;
  }

  // 実行結果のサマリー生成
  generateSummary(results, startTime) {
    const endTime = new Date();
    const duration = endTime - startTime;
    
    let totalNew = 0;
    let totalUpdated = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    
    results.forEach(result => {
      totalNew += result.new || 0;
      totalUpdated += result.updated || 0;
      totalDuplicates += result.duplicates || 0;
      if (result.error) totalErrors++;
    });
    
    return {
      executedAt: startTime,
      completedAt: endTime,
      duration: `${Math.round(duration / 1000)}秒`,
      feedsProcessed: results.length,
      newArticles: totalNew,
      updatedArticles: totalUpdated,
      duplicatesFound: totalDuplicates,
      errors: totalErrors,
      details: results
    };
  }

  // 実行ログの保存
  async saveExecutionLog(summary) {
    try {
      const logCollection = this.db.collection('execution_logs');
      await logCollection.add(summary);
      console.log('📝 実行ログを保存しました');
    } catch (error) {
      console.error('❌ ログ保存エラー:', error.message);
    }
  }

  // 記事の検索
  async searchArticles(query, limit = 10) {
    try {
      const snapshot = await this.newsCollection
        .where('title', '>=', query)
        .where('title', '<=', query + '\uf8ff')
        .limit(limit)
        .get();
      
      const articles = [];
      snapshot.forEach(doc => {
        articles.push({ id: doc.id, ...doc.data() });
      });
      
      return articles;
    } catch (error) {
      console.error('検索エラー:', error.message);
      return [];
    }
  }

  // 最新記事の取得
  async getLatestArticles(limit = 10) {
    try {
      const snapshot = await this.newsCollection
        .orderBy('publishedAt', 'desc')
        .limit(limit)
        .get();
      
      const articles = [];
      snapshot.forEach(doc => {
        articles.push({ id: doc.id, ...doc.data() });
      });
      
      return articles;
    } catch (error) {
      console.error('最新記事取得エラー:', error.message);
      return [];
    }
  }

  // クリーンアップメソッド
  async cleanup() {
    try {
      console.log('🧹 リソースのクリーンアップ中...');
      
      // Firestore接続のクリーンアップ
      if (this.db) {
        // 既存の処理完了を待つ
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('✅ クリーンアップ完了');
    } catch (error) {
      console.error('❌ クリーンアップエラー:', error.message);
    }
  }
}

// 実行部分
async function main() {
  let collector;
  try {
    collector = new ToyotaNewsCollector();
    
    // RSS収集実行
    const summary = await collector.collectAllFeeds();
    
    // 最新記事の表示
    console.log('\n📱 最新記事トップ3:');
    const latestArticles = await collector.getLatestArticles(3);
    latestArticles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   📅 ${article.publishedAt.toDate().toLocaleDateString()}`);
      console.log(`   🔗 ${article.link}\n`);
    });
    
    console.log('✅ 処理完了 - プログラムを終了します...');
    
  } catch (error) {
    console.error('❌ メイン処理エラー:', error.message);
  } finally {
    // Firebase接続を明示的に終了
    try {
      if (collector) {
        await collector.cleanup();
      }
      
      // Firebase Admin アプリを全て削除
      const apps = admin.apps;
      await Promise.all(apps.map(app => app.delete()));
      
      console.log('🔌 Firebase接続を終了しました');
      
      // プロセス終了
      process.exit(0);
      
    } catch (cleanupError) {
      console.error('❌ クリーンアップエラー:', cleanupError.message);
      process.exit(1);
    }
  }
}

// スクリプト直接実行時
if (require.main === module) {
  main();
}

module.exports = ToyotaNewsCollector;