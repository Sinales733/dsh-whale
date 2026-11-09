# dsh-motion · 灵动指示器

A client plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that makes the chat's running indicators livelier.

DeepSeek Harness 的客户端插件，让对话里的运行指示器更灵动。

## 效果 / What it does

**Deep diving 鲸尾**：鲸尾不再只播一个动画，而是每轮随机轮换（每圈都会轮到，不连续重复）：

| 名称 | 说明 |
|---|---|
| `original` | 原版摆尾（当前版本自带动画，逐帧还原） |
| `spin` / `sway` / `stroke` | 新版官方的旋转、转身、划水 |
| `fluke` | 举尾下潜：尾巴抬出水面、水从尾叶淌下，竖直滑入水中，再悄悄浮回 |
| `spout` | 喷水：鲸鱼头顶破水、喷出水柱，再沉下、尾巴回到原位 |

`fluke` 和 `spout` 画在一个由原版鲸尾轮廓推算出的 3D 鲸尾上，起止都是原版的静止姿态，和其他动画无缝衔接。

**工具调用**：调用进行中，行首图标按工具类型（搜索、读取、终端、编辑、代码、其他）播放线条动画；完成时图标外画一圈闭合圆环，失败时圆环断开并抖动。

系统开启"减少动态效果"时只显示静止图标。

## 安装 / Install

```bash
git clone https://github.com/Sinales733/dsh-motion.git
dsh plugin --profile desktop add link:/path/to/dsh-motion
```

桌面版的 `dsh` 位于安装目录下的 `resources/runtime/cli/bin/dsh.cmd`。也可以下载 [Releases](https://github.com/Sinales733/dsh-motion/releases) 中的 `.tgz` 包解压后用同样方式添加。安装后刷新 DSH 窗口即可。

## 配置 / Options

| 选项 | 说明 |
|---|---|
| `whale: "<name>"` | 固定只播某一个鲸尾动画（名称见上表） |
| `whaleMode: "turn"` | 每次出现只随机选一个，整轮对话不切换 |

## 开发 / Development

源码在 `src/`，`node build.mjs` 打包为 DSH 客户端模块 `lib/client.js`。`test/` 下的页面可直接在浏览器中预览各动画。

启动动画在单独的仓库：[dsh-splash](https://github.com/Sinales733/dsh-splash)。

## 致谢与许可 / Credits & License

- 插件代码：MIT License。
- `src/orig-frames.js` 与 `src/official-frames.js` 中的鲸尾帧来自 DeepSeek Harness 的原版及新版官方动画，版权归其原作者所有。
- 喷水水柱形状取自 Google [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/) 的 spouting whale（CC BY 4.0）。
- 举尾下潜动作参考 Wikimedia Commons 上 Edith Schreurs 拍摄的南露脊鲸照片（CC BY-SA 2.0）。
