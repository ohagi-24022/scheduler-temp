# あわせる

大学ごとに異なる講義のコマ時間を実時間へ変換し、グループの空き時間を合わせるPWAプロトタイプです。

## 起動方法

依存パッケージはありません。ローカルサーバーでこのフォルダを公開してください。

```powershell
python -m http.server 4173
```

ブラウザで `http://localhost:4173` を開きます。トップ画面の「サンプルイベントを見る」から、参加・予定入力・集計まで試せます。

## Firebase設定

イベントと参加者の予定はCloud Firestoreへ保存します。表示名・大学・スタンプは引き続きブラウザの `LocalStorage` に保存します。

Firebase Consoleで次の設定が必要です。

1. Authenticationのログイン方法で「匿名」を有効化
2. Firestore Databaseを作成
3. `firestore.rules` の内容をFirestoreのルールへ反映
4. Authenticationの「承認済みドメイン」に公開先ドメインを追加

Firebase CLIを利用する場合は、ログイン後に次のコマンドでルールを反映できます。

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

ローカル確認は `file://` で直接開かず、次のようにHTTPサーバーから起動してください。

```powershell
python -m http.server 4173
```

ブラウザで `http://localhost:4173` を開きます。
