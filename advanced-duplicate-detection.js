// advanced-duplicate-detection.js
// 高度な重複記事検出システム

const crypto = require('crypto');

class AdvancedDuplicateDetector {
  constructor() {
    // 類似度判定の閾値
    this.SIMILARITY_THRESHOLD = 0.8;
    this.TITLE_SIMILARITY_THRESHOLD = 0.7;
    
    // 無視する単語（ストップワード）
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 
      'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 
      'that', 'the', 'to', 'was', 'will', 'with', 'toyota', 'new'
    ]);
  }

  // 1. 基本的なID生成（完全一致用）
  generateBasicId(title, link) {
    const cleanLink = this.cleanUrl(link);
    const content = `${title.toLowerCase().trim()}-${cleanLink}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // 2. URLの正規化（パラメータ除去等）
  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // クエリパラメータを除去
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  // 3. テキストの正規化
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // 記号を空白に
      .replace(/\s+/g, ' ')      // 複数空白を1つに
      .trim();
  }

  // 4. 単語のトークン化（ストップワード除去）
  tokenize(text) {
    const normalized = this.normalizeText(text);
    const words = normalized.split(' ');
    return words.filter(word => 
      word.length > 2 && !this.stopWords.has(word)
    );
  }

  // 5. Jaccard係数による類似度計算
  calculateJaccardSimilarity(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // 6. コサイン類似度計算
  calculateCosineSimilarity(tokens1, tokens2) {
    const allTokens = new Set([...tokens1, ...tokens2]);
    const vector1 = [];
    const vector2 = [];
    
    allTokens.forEach(token => {
      vector1.push(tokens1.filter(t => t === token).length);
      vector2.push(tokens2.filter(t => t === token).length);
    });
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitude1 * magnitude2) || 0;
  }

  // 7. 公開日時の近接性チェック
  isTimeClose(date1, date2, hoursThreshold = 24) {
    const diffHours = Math.abs(date1 - date2) / (1000 * 60 * 60);
    return diffHours <= hoursThreshold;
  }

  // 8. 包括的な重複検出
  async findDuplicates(newArticle, existingArticles) {
    const duplicates = [];
    const newTokens = this.tokenize(newArticle.title + ' ' + newArticle.description);
    
    for (const existing of existingArticles) {
      const similarity = await this.calculateSimilarity(newArticle, existing);
      
      if (similarity.isDuplicate) {
        duplicates.push({
          existingId: existing.id,
          similarity: similarity,
          reason: similarity.reasons
        });
      }
    }
    
    return duplicates;
  }

  // 9. 類似度の総合判定
  async calculateSimilarity(article1, article2) {
    const tokens1 = this.tokenize(article1.title + ' ' + article1.description);
    const tokens2 = this.tokenize(article2.title + ' ' + article2.description);
    
    // タイトルのみの類似度
    const titleTokens1 = this.tokenize(article1.title);
    const titleTokens2 = this.tokenize(article2.title);
    const titleSimilarity = this.calculateJaccardSimilarity(titleTokens1, titleTokens2);
    
    // 全体の類似度
    const jaccardSimilarity = this.calculateJaccardSimilarity(tokens1, tokens2);
    const cosineSimilarity = this.calculateCosineSimilarity(tokens1, tokens2);
    
    // URL類似度
    const cleanUrl1 = this.cleanUrl(article1.link);
    const cleanUrl2 = this.cleanUrl(article2.link);
    const urlSimilarity = cleanUrl1 === cleanUrl2 ? 1.0 : 0.0;
    
    // 時間の近接性
    const timeClose = this.isTimeClose(
      new Date(article1.publishedAt), 
      new Date(article2.publishedAt),
      48 // 48時間以内
    );
    
    // 総合判定
    const reasons = [];
    let isDuplicate = false;
    
    // 完全一致チェック
    if (urlSimilarity === 1.0) {
      isDuplicate = true;
      reasons.push('同一URL');
    }
    
    // 高類似度 + 時間近接
    if (titleSimilarity >= this.TITLE_SIMILARITY_THRESHOLD && timeClose) {
      isDuplicate = true;
      reasons.push('タイトル類似 + 時間近接');
    }
    
    // 非常に高い類似度
    if (jaccardSimilarity >= this.SIMILARITY_THRESHOLD) {
      isDuplicate = true;
      reasons.push('内容高類似');
    }
    
    return {
      isDuplicate,
      titleSimilarity,
      jaccardSimilarity,
      cosineSimilarity,
      urlSimilarity,
      timeClose,
      reasons
    };
  }

  // 10. 重複記事のマージ処理
  mergeArticles(originalArticle, duplicateArticle) {
    return {
      ...originalArticle,
      // より詳細な情報があれば更新
      description: duplicateArticle.description.length > originalArticle.description.length 
        ? duplicateArticle.description 
        : originalArticle.description,
      
      // 追加のリンクを保存
      alternativeLinks: [
        ...(originalArticle.alternativeLinks || []),
        duplicateArticle.link
      ].filter((link, index, arr) => arr.indexOf(link) === index),
      
      // ソースを統合
      sources: [
        ...(originalArticle.sources || [originalArticle.source]),
        duplicateArticle.source
      ].filter((source, index, arr) => arr.indexOf(source) === index),
      
      // タグを統合
      tags: [
        ...(originalArticle.tags || []),
        ...(duplicateArticle.tags || [])
      ].filter((tag, index, arr) => arr.indexOf(tag) === index),
      
      // 更新日時
      updatedAt: new Date(),
      lastDuplicateFound: new Date()
    };
  }

  // 11. 重複検出レポート生成
  generateDuplicateReport(duplicates) {
    if (duplicates.length === 0) {
      return { hasDuplicates: false, message: '重複なし' };
    }
    
    const report = {
      hasDuplicates: true,
      count: duplicates.length,
      details: duplicates.map(dup => ({
        existingId: dup.existingId,
        similarity: Math.round(dup.similarity.jaccardSimilarity * 100),
        reasons: dup.similarity.reasons.join(', ')
      }))
    };
    
    return report;
  }
}

// 使用例とテスト
class DuplicateDetectionExample {
  static async runExample() {
    const detector = new AdvancedDuplicateDetector();
    
    // テスト記事
    const article1 = {
      id: 'test1',
      title: 'Toyota Launches New Electric Vehicle in 2025',
      description: 'Toyota Motor Corporation announced today the launch of a new electric vehicle model for the 2025 market year.',
      link: 'https://global.toyota/news/12345',
      publishedAt: new Date('2025-06-22T10:00:00Z'),
      source: 'Toyota Global'
    };
    
    const article2 = {
      id: 'test2', 
      title: 'Toyota Unveils Electric Vehicle for 2025 Market',
      description: 'The Japanese automaker Toyota has unveiled its latest electric vehicle model set to launch in 2025.',
      link: 'https://toyota.com/news/12345?utm_source=rss',
      publishedAt: new Date('2025-06-22T11:30:00Z'),
      source: 'Toyota USA'
    };
    
    const article3 = {
      id: 'test3',
      title: 'Toyota Reports Strong Financial Results for Q2',
      description: 'Toyota Motor Corporation reported strong financial performance for the second quarter.',
      link: 'https://global.toyota/financial/q2-2025',
      publishedAt: new Date('2025-06-20T09:00:00Z'),
      source: 'Toyota Global'
    };
    
    // 類似度計算
    console.log('=== 重複検出テスト ===\n');
    
    const similarity1vs2 = await detector.calculateSimilarity(article1, article2);
    console.log('Article1 vs Article2:');
    console.log(`  重複判定: ${similarity1vs2.isDuplicate ? 'YES' : 'NO'}`);
    console.log(`  タイトル類似度: ${Math.round(similarity1vs2.titleSimilarity * 100)}%`);
    console.log(`  Jaccard類似度: ${Math.round(similarity1vs2.jaccardSimilarity * 100)}%`);
    console.log(`  理由: ${similarity1vs2.reasons.join(', ') || 'なし'}\n`);
    
    const similarity1vs3 = await detector.calculateSimilarity(article1, article3);
    console.log('Article1 vs Article3:');
    console.log(`  重複判定: ${similarity1vs3.isDuplicate ? 'YES' : 'NO'}`);
    console.log(`  タイトル類似度: ${Math.round(similarity1vs3.titleSimilarity * 100)}%`);
    console.log(`  Jaccard類似度: ${Math.round(similarity1vs3.jaccardSimilarity * 100)}%`);
    console.log(`  理由: ${similarity1vs3.reasons.join(', ') || 'なし'}\n`);
    
    // 重複検出実行
    const duplicates = await detector.findDuplicates(article2, [article1, article3]);
    const report = detector.generateDuplicateReport(duplicates);
    
    console.log('=== 重複検出レポート ===');
    console.log(JSON.stringify(report, null, 2));
  }
}

// テスト実行
if (require.main === module) {
  DuplicateDetectionExample.runExample();
}

module.exports = AdvancedDuplicateDetector;