# dsh-whale

给 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）做的两样小东西，都围绕 DeepSeek 的鲸鱼标志，用细线条、单色、安静的风格。

| 文件夹 | 是什么 | 怎么装 |
|---|---|---|
| [`motion/`](motion) | **鲸尾指示器插件**：把对话运行时那个鲸鱼小图标换成会动的鲸尾（七种循环动画随机切换，衔接无缝），工具调用的小图标也会轻轻动起来。 | DSH 插件，`dsh plugin add` 一行装上，见 [motion/README.md](motion/README.md)。 |
| [`splash/`](splash) | **启动动画**：DSH 启动时随机播放 12 个线稿场景之一（尺规作图、示波器、汉字笔顺、声呐……），应用就绪后画面收进加载圈，无缝交给启动卡片。 | 不是插件，是写进 DSH 程序包 `app.asar` 的补丁，用 `install-splash.ps1` 安装，DSH 更新后需重装。见 [splash/README.md](splash/README.md)。 |

两者互不依赖，可以只用其中一个。颜色都跟随 DSH 当前的深色 / 浅色主题。更新记录见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

代码采用 MIT License。DeepSeek 鲸鱼标志、DSH 原版鲸尾帧及原有代码与素材，版权归其原作者所有；其他素材来源见各文件夹的说明。
