# dsh-splash

DeepSeek Harness（DSH）的启动动画。每次启动 DSH 时随机播放 10 个线稿场景中的一个；应用就绪后，画面收拢成网页版自己的加载圈，无缝交接给启动卡片。

它不是 DSH 插件：启动画面要在插件系统加载之前出现，所以是以补丁形式写进 DSH 的程序包 `resources/app.asar`。DSH 更新会覆盖它，届时需要重新安装。

## 场景

| 场景 | 内容 |
|---|---|
| CONSTRUCT | 尺规作图画出鲸 |
| ORBIT | 线框地球与卫星 |
| SIGNAL | X-Y 示波器描出鲸 |
| WEAVE | 模乘弦图（string art），鲸从织线中显现 |
| PULSAR | 脉冲星式的高度图，收尾时躺平、压成一线、卷成进度弧 |
| CURRENT | 绕障碍物的流场，鲸是水流留下的空白 |
| SPLINE | 绘图桌上的放样样条，压铁（drafting "whales"）把圆拉成鲸 |
| HANZI | 米字格上按笔顺写出「鲸」，16 个笔画游成鲸，收尾写出第 17 笔 |
| SHADOW | 转台上的铁丝雕塑：正面投影是鲸，侧面投影是圆 |
| ECHO | 声呐脉冲的反光、声影和回声勾出鲸 |

## 目录

- `src/core.js`：共享工具（坐标、缓动、鲸形、交接参数）。
- `src/scenes/*.js`：每个场景一个文件。写新场景先看 `SCENE-GUIDE.md`。
- `src/boot.js`：选场景、帧循环、收尾交接协议。
- `splash.html`、`splash.css`、`splash.js`：构建好的启动页。
- `main-splash.js.txt`：主进程里显示启动窗口、测量启动卡片并交接的那段代码。
- `tools/build-splash.mjs`：构建；`tools/lab-shot.mjs`：虚拟时钟下的逐帧截图与跳帧检测；`tools/asar-*.mjs`：打包进 `app.asar`。
- `preview/splash-viewer.html`：实时播放；`preview/lab.html` + `lab-clock.js`：逐帧实验台。
- `install-splash.ps1` / `restore-splash.ps1`：安装到本机 DSH / 还原原版。

脚本按开发机的目录结构写成（`splash/`、`tools/`、`preview/`、`asar-src/` 并列于同一根目录）。`asar-src/` 是从 DSH 解包出的程序文件，不在本仓库中。

## 许可

代码采用 MIT License。DeepSeek 鲸鱼标志及 DeepSeek Harness 的原有代码与素材版权归其原作者所有。
