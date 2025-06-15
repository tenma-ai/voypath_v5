# localhost:5173 接続エラーの解決方法

## 問題
`npm run dev`実行後、localhost:5173にアクセスできない（ERR_CONNECTION_REFUSED）

## 解決手順

### 1. 別のターミナルウィンドウを開いて実行

```bash
cd /Users/kominetenma/Desktop/voypath_v5/project
npm run dev
```

### 2. それでもダメな場合は、ポートを変更

`vite.config.ts`を編集：
```typescript
server: {
  host: '127.0.0.1',
  port: 3000, // 5173から3000に変更
  open: true,
}
```

### 3. ファイアウォールの確認

macOSのファイアウォール設定を確認：
- システム環境設定 → セキュリティとプライバシー → ファイアウォール
- Node.jsやターミナルがブロックされていないか確認

### 4. 代替方法：プレビューモード

```bash
npm run build
npm run preview
```

### 5. 最終手段：すべてのNode.jsプロセスをリセット

```bash
# すべてのNode.jsプロセスを終了
killall node

# キャッシュをクリア
rm -rf node_modules/.vite
rm -rf .vite

# 再度実行
npm run dev
```

### 6. ブラウザの設定確認

- ブラウザのプロキシ設定を確認
- 別のブラウザ（Chrome、Safari、Firefox）で試す
- プライベートブラウジングモードで試す

## 動作確認URL

以下のURLすべてを試してください：
- http://localhost:5173
- http://127.0.0.1:5173
- http://[::1]:5173
- http://192.168.0.35:5173 (ネットワークアドレス)

## それでも解決しない場合

1. `.env`ファイルを作成して環境変数を設定：
```env
VITE_PORT=3000
VITE_HOST=0.0.0.0
```

2. package.jsonのスクリプトを変更：
```json
"dev": "vite --host 0.0.0.0 --port 3000"
```

これらの手順を順番に試してみてください。