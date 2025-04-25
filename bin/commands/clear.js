import fs from 'fs';
import path from 'path';
export default function clear() {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const packageLockPath = path.join(process.cwd(), 'package-lock.json');

    if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        console.log('已删除 node_modules 文件夹');
    } else {
        console.log('未找到 node_modules 文件夹');
    }

    if (fs.existsSync(packageLockPath)) {
        fs.rmSync(packageLockPath);
        console.log('已删除 package-lock.json 文件');
    } else {
        console.log('未找到 package-lock.json 文件');
    }
}
