#!/usr/bin/env node
import { program } from 'commander';
import create from './commands/create.js';
import clear from './commands/clear.js';
import setNpm from './commands/setNpm.js';
import bindGit from './commands/bindGit.js';
import createApi from './commands/createApi.js';
import ls from './commands/ls.js';

program
    .command('create')
    .description('从线上仓库生成项目到当前目录（不包含 .git）')
    .action(create);

program
    .command('clear')
    .description('删除 node_modules 和 package-lock.json')
    .action(clear);

program
    .command('set-npm')
    .description('交互式切换 npm 镜像源')
    .action(setNpm);

program
    .command('bind git')
    .description('绑定线上仓库地址')
    .action(bindGit);

program
    .command('create-api')
    .description('生成 API 请求结构和 TS 接口')
    .action(createApi);

// 显示支持的指令列表
program
    .command('ls')
    .description('显示当前支持的指令列表')
    .action(ls);

program.parse();
