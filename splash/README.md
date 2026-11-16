# dsh-splash

DeepSeek Harness（DSH）的启动动画。每次启动 DSH 时随机播放 12 个线稿场景中的一个；应用就绪后，画面收拢成网页版自己的加载圈，无缝交接给启动卡片。

它不是 DSH 插件：启动画面要在插件系统加载之前出现，所以是以补丁形式写进 DSH 的程序包 `resources/app.asar`。安装脚本按你电脑上装的 DSH 版本现场打补丁，不带预先打好的程序包，所以不会把 DSH 换成别的版本。DSH 更新会覆盖它：装了 [dsh-motion 插件](https://github.com/Sinales733/dsh-motion) 会自动装回，否则再运行一次安装脚本。

## 安装（Windows）

1. 退出 DSH（托盘图标也要退出；脚本会等它关掉）。
2. 在本文件夹里右键 `install-splash.ps1` →「使用 PowerShell 运行」，或者：

   ```powershell
   powershell -ExecutionPolicy Bypass -File install-splash.ps1 -Relaunch
   ```

- 用的是 DSH 自带的运行环境，不用另装 Node。
- 自动找到 DSH 的安装位置；找不到时加 `-InstallDir <文件夹>`。
- 原版程序包留在旁边，名为 `app.asar.orig`。
- 新版 DSH 改了代码、补丁位置对不上时，脚本什么都不改，提示“暂不支持”。
- 还原：`restore-splash.ps1`。只会还原成当前这个版本的原版，不会把 DSH 退回旧版；还原后 motion 插件也不再自动装回。
- 查看状态：`install-splash.ps1 -Command status`。

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
| CHLADNI | 克拉尼沙图：一根沙弦嗡鸣后张开成振动板，沙粒随频率跳成两种节线花纹，最后聚成鲸；收尾时鲸的轮廓像线一样被抽走，绕上加载圈 |
| BATHY | 等深线海图：一滴水的涟漪荡开、化成缓慢流动的海底地形，鲸像岛一样隆起；收尾时地形收拢成同心圆，最后一条等深线就是加载圈 |

## 目录

- `src/core.js`：共享工具（坐标、缓动、鲸形、交接参数）。
- `src/scenes/*.js`：每个场景一个文件。写新场景先看 `SCENE-GUIDE.md`。
- `src/boot.js`：选场景、帧循环、收尾交接协议。
- `splash.html`、`splash.css`、`splash.js`：构建好的启动页。
- `main-splash.js.txt`：主进程里显示启动窗口、测量启动卡片并交接的那段代码。
- `tools/build-splash.mjs`：构建；`tools/lab-shot.mjs`：虚拟时钟下的逐帧截图与跳帧检测；`tools/asar-*.mjs`：打包进 `app.asar`。
- `preview/splash-viewer.html`：实时播放；`preview/lab.html` + `lab-clock.js`：逐帧实验台。
- `patch-app.mjs`：给已安装的 DSH 打补丁、还原、查看状态；`install-splash.ps1` / `restore-splash.ps1` 是它的双击入口。

构建和实验台脚本按开发机的目录结构写成（`splash/`、`tools/`、`preview/`、`asar-src/` 并列于同一根目录）。`asar-src/` 是从 DSH 解包出的程序文件，不在本仓库中。安装用不到这些。

## 许可

代码采用 MIT License。DeepSeek 鲸鱼标志及 DeepSeek Harness 的原有代码与素材版权归其原作者所有。
