// simple-json-check.js
// firebase-key.json の簡単なチェック

const fs = require('fs');

console.log('=== firebase-key.json チェック ===\n');

// 1. ファイル存在確認
if (!fs.existsSync('./firebase-key.json')) {
  console.log('❌ firebase-key.json が見つかりません');
  process.exit(1);
}

console.log('✅ ファイルが存在します');

// 2. ファイル内容の読み込み
let content;
try {
  content = fs.readFileSync('./firebase-key.json', 'utf8');
  console.log('✅ ファイル読み込み成功');
  console.log(`📏 ファイルサイズ: ${content.length} 文字`);
} catch (error) {
  console.log('❌ ファイル読み込みエラー:', error.message);
  process.exit(1);
}

// 3. 内容の先頭を表示
console.log('\n📄 ファイル内容（先頭200文字）:');
console.log('---');
console.log(content.substring(0, 200));
console.log('---');

// 4. 内容の末尾を表示
console.log('\n📄 ファイル内容（末尾100文字）:');
console.log('---');
console.log(content.substring(content.length - 100));
console.log('---');

// 5. JSON形式チェック
console.log('\n🔍 JSON形式チェック:');
try {
  const jsonData = JSON.parse(content);
  console.log('✅ JSON形式は正常です');
  console.log('📋 type:', jsonData.type);
  console.log('📋 project_id:', jsonData.project_id);
  console.log('📋 client_email:', jsonData.client_email ? 'あり' : 'なし');
  console.log('📋 private_key:', jsonData.private_key ? 'あり' : 'なし');
} catch (jsonError) {
  console.log('❌ JSON形式エラー:');
  console.log('   エラーメッセージ:', jsonError.message);
  console.log('   エラー位置:', jsonError.message.match(/position (\d+)/)?.[1] || '不明');
  
  // エラー箇所の特定
  if (jsonError.message.includes('position')) {
    const pos = parseInt(jsonError.message.match(/position (\d+)/)?.[1]);
    if (pos) {
      console.log('\n🎯 エラー箇所周辺:');
      const start = Math.max(0, pos - 50);
      const end = Math.min(content.length, pos + 50);
      console.log('---');
      console.log(content.substring(start, end));
      console.log('---');
    }
  }
}

console.log('\n=== チェック完了 ===');