#!/usr/bin/env node
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import degit from 'degit';
import ora from 'ora'; // 引入 ora 进行 loading 效果

// 创建项目指令
program
    .command('create')
    .description('从线上仓库生成项目到当前目录（不包含 .git）')
    .action(async () => {
        const repo = 'windcannons/vue3Template'; // degit 方式不需要 direct:
        const currentDir = process.cwd();

        // 检查当前目录是否为空
        if (fs.readdirSync(currentDir).length > 0) {
            console.error('当前目录不为空，请选择一个空目录或清空当前目录。');
            return;
        }

        const spinner = ora('正在生成项目，请稍候...').start(); // 显示 loading

        try {
            const emitter = degit(repo, { cache: false, force: true });
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

// 显示支持的指令列表
program
    .command('ls')
    .description('显示当前支持的指令列表')
    .action(() => {
        console.log('指令列表:');
        console.log('  lchao create - 生成新项目到当前目录');
        console.log('  lchao clear  - 清理当前目录下的 node_modules 和 package-lock.json');
        console.log('  lchao ls     - 显示当前支持的指令列表');
    });

// 解析命令行参数
program.parse(process.argv);
