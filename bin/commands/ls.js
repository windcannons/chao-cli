export default async function bindGit() {
    console.log('指令列表:');
    console.log('  lchao create - 生成新项目到当前目录');
    console.log('  lchao clear  - 清理当前目录下的 node_modules 和 package-lock.json');
    console.log('  lchao set-npm  - 切换 npm 镜像指令');
    console.log('  lchao bind git - 绑定线上仓库地址到当前项目');
    console.log('  lchao create-api - 生成 API 请求文件');
    console.log('  lchao ls     - 显示当前支持的指令列表');
}
