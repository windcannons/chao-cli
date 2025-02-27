#!/usr/bin/env node
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import degit from 'degit';
import ora from 'ora'; // 引入 ora 进行 loading 效果
import { execSync } from 'child_process'; // 引入 child_process 执行系统命令
import inquirer from 'inquirer';


// 创建项目指令
program
    .command('create')
    .description('从线上仓库生成项目到当前目录（不包含 .git）')
    .action(async () => {
        const currentDir = process.cwd();

        // 检查当前目录是否为空
        if (fs.readdirSync(currentDir).length > 0) {
            console.error('当前目录不为空，请选择一个空目录或清空当前目录。');
            return;
        }

        // 选择框架
        const { framework } = await inquirer.prompt([
            {
                type: 'list',
                name: 'framework',
                message: '请选择项目框架:',
                choices: ['Vue', 'Nuxt3', 'UniApp'],
            }
        ]);

        let repoUrl = '';
        switch (framework) {
            case 'Vue':
                repoUrl = 'https://github.com/windcannons/vue3Template.git';
                break;
            case 'Nuxt3':
                repoUrl = 'https://github.com/windcannons/nuxt3Template.git';
                break;
            case 'UniApp':
                repoUrl = 'https://github.com/windcannons/uniappTemplate.git';
                break;
            default:
                console.error('未知框架');
                return;
        }

        const spinner = ora('正在生成项目，请稍候...').start();

        try {
            const emitter = degit(repoUrl, { cache: false, force: true });
            await emitter.clone(currentDir);
            spinner.succeed(`项目已成功生成到当前目录: ${currentDir}`);
        } catch (err) {
            spinner.fail('生成项目失败');
            console.error('错误详情:', err);
            console.error('请检查仓库地址是否正确，或尝试使用代理。');
        }
    });

// 清理 node_modules 和 package-lock.json 指令
program
    .command('clear')
    .description('删除当前目录下的 node_modules 文件夹和 package-lock.json 文件')
    .action(() => {
        const currentDir = process.cwd();
        const nodeModulesPath = path.join(currentDir, 'node_modules');
        const packageLockPath = path.join(currentDir, 'package-lock.json');

        const spinner = ora('正在清理项目缓存，请稍候...').start();

        try {
            if (fs.existsSync(nodeModulesPath)) {
                fs.rmSync(nodeModulesPath, { recursive: true, force: true });
            }

            if (fs.existsSync(packageLockPath)) {
                fs.rmSync(packageLockPath, { force: true });
            }

            spinner.succeed('项目缓存清理完成');
        } catch (err) {
            spinner.fail('清理失败');
            console.error('错误详情:', err);
        }
    });

// 绑定线上仓库地址指令
program
    .command('bind git')
    .description('绑定线上仓库地址到当前项目，并处理文件冲突')
    .action(() => {
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
    });


// 显示支持的指令列表
program
    .command('ls')
    .description('显示当前支持的指令列表')
    .action(() => {
        console.log('指令列表:');
        console.log('  lchao create - 生成新项目到当前目录');
        console.log('  lchao clear  - 清理当前目录下的 node_modules 和 package-lock.json');
        console.log('  lchao bind git - 绑定线上仓库地址到当前项目');
        console.log('  lchao ls     - 显示当前支持的指令列表');
    });

// 解析命令行参数
program.parse(process.argv);
