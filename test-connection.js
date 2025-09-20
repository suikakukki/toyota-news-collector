// test-connection.js
// Firebase Admin SDK の接続テスト

require('dotenv').config();
const admin = require('firebase-admin');

async function testFirebaseConnection() {
  try {
    console.log('🔄 Firebase 接続テスト開始...');
    
    // サービスアカウントキーの読み込み
    const serviceAccount = require('./firebase-key.json');
    console.log('✅ サービスアカウントキー読み込み成功');
    
    // Firebase Admin 初期化
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    console.log('✅ Firebase Admin SDK 初期化成功');
    
    // Firestore インスタンス取得
    const db = admin.firestore();
    console.log('✅ Firestore インスタンス取得成功');
    
    // 接続テスト（テストドキュメント作成）
    const testRef = db.collection('connection_test').doc('test_doc');
    await testRef.set({
      message: 'Firebase 接続成功！',
      timestamp: new Date(),
      testFrom: 'toyota-news-collector'
    });
    console.log('✅ Firestore への書き込み成功');
    
    // テストドキュメント読み取り
    const testDoc = await testRef.get();
    if (testDoc.exists) {
      console.log('✅ Firestore からの読み取り成功');
      console.log('📄 テストデータ:', testDoc.data());
    }
    
    // テストドキュメント削除
    await testRef.delete();
    console.log('✅ テストドキュメント削除完了');
    
    console.log('\n🎉 Firebase 接続テスト完了！');
    console.log('👍 toyota-news-collector から Firestore への接続が確認されました');
    
  } catch (error) {
    console.error('\n❌ Firebase 接続エラー:');
    
    if (error.code === 'ENOENT' && error.path && error.path.includes('firebase-key.json')) {
      console.error('🔑 firebase-key.json ファイルが見つかりません');
      console.error('   → Firebase Console からサービスアカウントキーをダウンロードして配置してください');
    } else if (error.message.includes('project')) {
      console.error('🏗️  プロジェクトID の設定に問題があります');
      console.error('   → .env ファイルの FIREBASE_PROJECT_ID を確認してください');
    } else if (error.message.includes('permission')) {
      console.error('🔐 権限エラーです');
      console.error('   → サービスアカウントの権限設定を確認してください');
    } else {
      console.error('🐛 予期しないエラー:', error.message);
    }
    
    console.error('\n🔧 トラブルシューティング:');
    console.error('1. firebase-key.json が正しい場所にあるか確認');
    console.error('2. .env ファイルの FIREBASE_PROJECT_ID が正しいか確認');  
    console.error('3. Firebase プロジェクトでFirestoreが有効になっているか確認');
  }
}

// 実行
if (require.main === module) {
  testFirebaseConnection();
}

module.exports = { testFirebaseConnection };