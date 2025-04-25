import ora from 'ora';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

export default async function setNpm() {
    // 捕获 Ctrl+C 信号，防止程序崩溃
    process.on('SIGINT', () => {
        console.log('\n操作已取消');
        process.exit(0);
    });

    try {
        const { registry } = await inquirer.prompt([
            {
                type: 'list',
                name: 'registry',
                message: '请选择要切换的 npm 镜像源：',
                choices: [
                    { name: '官方源（https://registry.npmjs.org/）', value: 'official' },
                    { name: '淘宝镜像（https://registry.npmmirror.com/）', value: 'taobao' },
                    { name: '阿里云镜像（https://npm.aliyun.com/）', value: 'aliyun' }
                ]
            }
        ]);

        let url = '';

        switch (registry) {
            case 'official':
                url = 'https://registry.npmjs.org/';
                break;
            case 'taobao':
                url = 'https://registry.npmmirror.com/';
                break;
            case 'aliyun':
                url = 'https://npm.aliyun.com/';
                break;
        }

        const spinner = ora(`正在切换到 ${url} ...`).start();

        try {
            execSync(`npm config set registry ${url}`, { stdio: 'ignore' });
            spinner.succeed(`npm 镜像已切换为：${url}`);
        } catch (err) {
            spinner.fail('镜像切换失败');
            console.error('错误详情:', err);
        }
    } catch (err) {
        process.exit(0); // 确保程序正常退出
    }
}
