# 欢迎使用 Chao 的脚手架

## 指令列表

### 1. 生成新项目

**指令：**

```sh
lchao create
```

**描述：** 选择项目框架（Vue3、Nuxt3、UniApp）生成项目到当前目录。



------

### 2. 清理项目缓存

**指令：**

```sh
lchao clear
```

**描述：** 删除当前目录下的 `node_modules` 文件夹和 `package-lock.json` 文件。



------

### 3. 绑定 Git 远程仓库

**指令：**

```sh
lchao bind git
```

**描述：** 绑定线上仓库地址到当前项目，并处理文件冲突。





------

### 4. 显示支持的指令列表

**指令：**

```sh
lchao ls
```

**描述：** 显示当前支持的指令列表。

**输出示例：**

```sh
指令列表:
  lchao create - 生成新项目到当前目录
  lchao clear  - 清理当前目录下的 node_modules 和 package-lock.json
  lchao bind git - 绑定线上仓库地址到当前项目
  lchao ls     - 显示当前支持的指令列表
```
