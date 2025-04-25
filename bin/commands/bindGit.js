import fs from 'fs';
import path from 'path';
import ora from 'ora'; // 引入 ora 进行 loading 效果
import {execSync} from 'child_process'; // 引入 child_process 执行系统命令
import inquirer from 'inquirer';

export default async function bindGit() {
    process.stdout.write('请输入线上仓库地址: ');
    process.stdin.once('data', async (data) => {
        const gitUrl = data.toString().trim();
        if (!gitUrl) {
            console.error('仓库地址不能为空');
            process.stdin.pause();
            return;
        }

        const spinner = ora('正在绑定仓库地址，请稍候...').start();
        const currentDir = process.cwd();

        try {
            let isGitRepo = false;
            try {
                execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
                isGitRepo = true;
            } catch (err) {
                isGitRepo = false;
            }

            if (!isGitRepo) {
                spinner.text = '正在初始化新的 Git 仓库...';
                execSync('git init', { stdio: 'inherit' });
            }

            spinner.text = '正在设置远程仓库地址...';
            try {
                execSync(`git remote set-url origin ${gitUrl}`, { stdio: 'inherit' });
            } catch {
                execSync(`git remote add origin ${gitUrl}`, { stdio: 'inherit' });
            }

            const remoteOutput = execSync('git remote -v', { encoding: 'utf-8' });
            if (!remoteOutput.includes(gitUrl)) {
                throw new Error('远程仓库地址绑定失败，请检查仓库地址是否正确。');
            }

            spinner.text = '正在拉取远程仓库的元数据...';
            execSync('git fetch --all', { stdio: 'inherit' });

            const remoteBranches = execSync('git branch -r', { encoding: 'utf-8' })
                .split('\n')
                .map(branch => branch.trim().replace('origin/', ''))
                .filter(branch => branch);

            const defaultBranch = remoteBranches.includes('main') ? 'main' : 'master';

            spinner.text = '正在检查文件冲突...';
            const localFiles = fs.readdirSync(currentDir);
            const remoteFiles = execSync(`git ls-tree --name-only -r origin/${defaultBranch}`, { encoding: 'utf-8' })
                .split('\n')
                .filter(f => f);

            const conflicts = localFiles.filter(file => remoteFiles.includes(file));

            if (conflicts.length > 0) {
                spinner.stop();
                console.log(`检测到文件冲突：${conflicts.join(', ')}`);

                const { choice } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'choice',
                        message: '请选择如何解决冲突:',
                        choices: [
                            { name: '替换冲突的文件', value: 'yes' },
                            { name: '保留本地文件', value: 'no' }
                        ]
                    }
                ]);

                if (choice === 'yes') {
                    conflicts.forEach(file => {
                        const filePath = path.join(currentDir, file);
                        if (fs.lstatSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    });
                } else {
                    console.log('已选择保留本地文件，操作取消。');
                    process.stdin.pause();
                    return;
                }
            }

            spinner.start('正在拉取远程仓库的内容...');
            execSync(`git pull origin ${defaultBranch}`, { stdio: 'inherit' });
            spinner.succeed('仓库地址已成功绑定并更新');
        } catch (err) {
            spinner.fail('绑定仓库地址失败');
            console.error('错误详情:', err.message);
        } finally {
            process.stdin.pause();
        }
    });
}
