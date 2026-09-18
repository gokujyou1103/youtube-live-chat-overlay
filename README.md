# YouTube Live Chat Overlay PoC

YouTube Live Chatのpop-outページをそのままElectronで表示し、ページ背景だけを透明化するWindows 11向けPoCです。YouTube Data API、APIキー、コメントのスクレイピング、独自UIへの再描画は使用しません。

## 起動

Node.js 20以降をインストールした環境で、このフォルダをPowerShellまたはコマンドプロンプトで開きます。

```powershell
npm install
npm start
```

起動後、次の形式のURLを入力します。

```text
https://www.youtube.com/live_chat?is_popout=1&v=VIDEO_ID
```

URL入力欄では右クリックメニューから切り取り、コピー、貼り付け、削除、すべて選択を使用できます。

タイトルバーの歯車ボタンから表示設定を開けます。背景の不透過度（0～100%、100%で選択テーマ色の背景）、文字サイズ（50～200%）、白文字＋黒縁、常に最前面のON/OFF、テーマ色（灰色・白色・ピンク・水色・緑色）は「変更を適用」を押したときに保存され、設定画面が閉じます。設定画面下部の「閉じる」「変更を適用」はスクロール中も固定表示されます。不透過度とテーマ色は選択中にプレビューでき、適用せず閉じた場合は保存済みの値へ戻ります。`—` ボタンを押すとスクロール不能なタイトルバーだけの表示になり、もう一度押すと元のサイズへ戻ります。

YouTubeの「トップチャット」ヘッダーは、コメント背景より15ポイント高い不透過度（上限100%）で表示されます。
YouTubeの案内カード背景も、同じテーマ色と追加不透過度へ連動します。
「白文字＋黒縁」がONの場合は、通常コメント・Super Chat・Super Sticker・メンバーシップ、画面上の「トップチャット」ラベル、「トップファン」などのヘッダーボタン、固定メッセージ・案内カードに外側の黒縁が適用されます。ポップアップメニューや三点メニューは対象外です。

## 操作

- `Ctrl + Shift + 9`: マウスイベント透過のON/OFF（透過中も有効なグローバルショートカット）
- `Ctrl + L`: URL入力画面へ戻る
- `Ctrl + Shift + Q`: アプリを終了
- ウィンドウ端のドラッグ: リサイズ

マウス透過がOFFのときはウィンドウ枠が青、ONのときは黄緑で表示されます。

タイトルバーの「←」ボタンでも、チャット表示からURL入力画面へ戻れます。

透明化を維持するため、常時見えるカスタムタイトルバー、青いウィンドウ枠、閉じるボタンを表示します。タイトルバーをドラッグして移動できます。

## 実装上のポイント

- `BrowserWindow` は `transparent: true`、`frame: false`、`alwaysOnTop: true`、`resizable: true`
- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- DevToolsは無効化（`devTools: false`）
- preloadが公開するIPC APIはローカル入力画面だけで有効
- 許可する遷移先はHTTPSの `youtube.com/live_chat` のみ
- YouTubeのDOMには背景・文字・入力パネル表示を調整するCSSのみを注入し、コメントの取得・解析・再構成は行わない
- チャット下部のログイン／メッセージ入力パネルはCSSで非表示
- YouTubeのコメントや各種メッセージはYouTube自身の描画結果をそのまま表示

YouTube側のDOM構造が変更された場合は、`main.js` の `transparentChatCss` に背景を持つ新しいコンテナのセレクターを追加してください。

## Windows用EXEの作成

Node.jsのLTS版がインストール済みであれば、`build-exe.cmd` をダブルクリックするだけでビルドできます。コマンドで実行する場合は次のとおりです。

```powershell
npm install
npm run build
```

`dist` フォルダに次の2種類が生成されます。

- `YouTube-Live-Chat-Overlay-Setup-1.0.0-x64.exe`: インストーラー版
- `YouTube-Live-Chat-Overlay-Portable-1.0.0-x64.exe`: インストール不要版

PoCにはコード署名証明書を設定していないため、別のPCで初回起動するとWindows SmartScreenの警告が表示される場合があります。

## npmを使わずにPortable版を作る

`build-portable-no-npm.cmd` をダブルクリックしてください。PowerShell、BITS、`Invoke-WebRequest`、`Expand-Archive`、`Compress-Archive`というWindows標準機能だけを使用します。

スクリプトはElectron公式リリースZIPをGitHubから取得し、アプリのソースを `resources\app` に配置します。完了すると `dist-no-npm` に次の成果物ができます。

- `YouTube Live Chat Overlay\YouTube Live Chat Overlay.exe`: 実行ファイルを含むPortableフォルダ
- `YouTube-Live-Chat-Overlay-Portable-x64.zip`: 配布用ZIP

ElectronアプリはランタイムDLLやリソースも必要なため、`exe`だけをフォルダから取り出さず、フォルダ全体を使用・配布してください。この方法ではNode.jsもnpmも不要です。

## 開発用の構成

- `main.js`: ウィンドウ・表示状態・IPCの制御
- `lib/settings.js`: 設定の検証・保存とテーマ背景色
- `lib/chat-style.js`: 非同期CSS更新の管理
- `lib/chat-base.css` / `lib/chat-outline.css`: YouTube表示用CSS
- `renderer/themes.css`: 両画面で共有する配色
- `preload.js`: ローカル画面向けAPIと通知の共通処理

`npm test`で、設定保存・未適用プレビューの分離・CSS更新競合の回帰テストを実行できます。
