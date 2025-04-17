#!/usr/bin/env node
import {
    program
} from 'commander';
import fs
    from 'fs';
import path
    from 'path';
import degit
    from 'degit';
import ora
    from 'ora'; // 引入 ora 进行 loading 效果
import {
    execSync
} from 'child_process'; // 引入 child_process 执行系统命令
import inquirer
    from 'inquirer';
import axios
    from 'axios'; // 引入 axios 用于请求 API 文档

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
                repoUrl = 'https://github.com/windcannons/newUniTemplate.git';
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

// 创建 API 请求文件夹和文件指令
program
    .command('create-api')
    .description('根据输入的请求地址生成 API 请求文件夹、文件以及 TypeScript 接口文档')
    .action(async () => {
        const currentDir = process.cwd(); // 当前工作目录
        const createApiDir = path.join(currentDir, 'createApi');
        const indexJsonPath = path.join(createApiDir, 'index.json');

        // 检查是否存在 src 文件夹
        const srcDirPath = path.join(currentDir, 'src');
        const hasSrcDir = await hasDirectory(srcDirPath)

        //是否为ts语法
        const isTsSyntax = await hasTsFileInDir(currentDir);

        const spinner = ora('正在生成 API 请求文件夹和文件，请稍候...').start();

        try {
            // 确保 createApi 文件夹存在
            fs.mkdirSync(createApiDir, { recursive: true });

            let requestUrl;
            let apiUrl;

            // 检查 index.json 文件是否存在
            if (fs.existsSync(indexJsonPath)) {
                // 读取 index.json 文件
                const indexJson = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8'));
                requestUrl = indexJson.requestUrl;

                if (!requestUrl || requestUrl.trim() === '') {
                    throw new Error('请求地址为空，请先绑定请求地址');
                }

                apiUrl = `${requestUrl}`;
            } else {
                // 如果 index.json 文件不存在，生成默认的 index.json 文件
                const defaultIndexJson = { requestUrl: '' };
                fs.writeFileSync(indexJsonPath, JSON.stringify(defaultIndexJson, null, 2));
                throw new Error('请求地址为空，请先绑定请求地址');
            }

            // 获取 API 数据
            const response = await axios.get(apiUrl);
            const apiData = response.data;
            if (!apiData){
                spinner.fail('requestUrl地址错误');
                return
            }

            // 生成 TypeScript 接口文档
            generateTsInterfaces(apiData, currentDir,hasSrcDir, isTsSyntax);

            spinner.succeed('API 请求文件夹和文件已成功生成');
        } catch (err) {
            spinner.fail('生成 API 请求文件夹和文件失败');
            console.error('错误详情:', err.message);
            if (err.message.includes('请求地址为空')) {
                console.error('请在 createApi/index.json 文件中绑定请求地址。');
            }
        }
    });

// 异步函数，用于检查目录中是否存在 .ts 文件
async function hasTsFileInDir(dir) {
    try {
        const files = await fs.promises.readdir(dir); // 读取目录内容
        return files.some(file => path.extname(file) === '.ts'); // 检查是否有 .ts 文件
    } catch (error) {
        console.error('读取目录时发生错误：', error.message);
        return false;
    }
}
// 异步函数，用于检查路径是否存在且是一个目录
async function hasDirectory(dirPath) {
    try {
        const stats = await fs.promises.stat(dirPath); // 获取路径的状态信息
        return stats.isDirectory(); // 检查是否是目录
    } catch (error) {
        // 如果路径不存在，stat 会抛出错误
        return false;
    }
}

function generateTsInterfaces(apiData, currentDir,hasSrcDir, isTsSyntax) {
    let tsDir
    if (hasSrcDir){
        tsDir = path.join(currentDir, 'src', 'api', 'list');
    }else{
        tsDir = path.join(currentDir, 'api', 'list');
    }

    fs.mkdirSync(tsDir, { recursive: true });

    //请求目录数组
    const tags = apiData.tags || [];
    //请求详情数组
    const paths = apiData.paths || {};

    // 类型映射表：将后端类型映射为前端 TypeScript 类型
    const typeMapping = {
        integer: 'number',
        long: 'number',
        float: 'number',
        double: 'number',
        decimal: 'number',
        number: 'number',
        string: 'string',
        text: 'string',
        char: 'string',
        varchar: 'string',
        boolean: 'boolean',
        date: 'string', // 日期通常以字符串形式处理
        time: 'string',
        datetime: 'string',
        timestamp: 'string',
        object: 'any', // JSON 对象
        array: 'any[]', // JSON 数组
        file: 'File', // 文件类型
        blob: 'Blob', // 二进制数据
        clob: 'string', // 大文本
        uuid: 'string', // UUID
        enum: 'string', // 枚举类型通常以字符串处理
        json: 'any', // JSON 数据
        any: 'any' // 通用类型
    };


    tags.forEach((tag, index) => {
        const tagName = tag.name;
        if (formatString(tagName)) {
            const tsFilePath = path.join(tsDir, `${formatString(tagName)}.${isTsSyntax ? 'ts' : 'js'}`); // 添加 Controller 后缀
            let tsContent =
                `import Request
  from "../request";

/**
 * @name ${tag.name}
 */

export const ${formatString(tagName)} = {
`; // 添加 Controller 后缀

            //console.log(paths)
            for (const path in paths) {
                //每个接口地址
                const pathItem = paths[path];
                //console.log(pathItem)
                //每个请求方式
                for (const method in pathItem) {
                    const item = pathItem[method]
                    if (item.tags.includes(tagName)) {
                        tsContent +=
                            `    // ${item.summary}${item.description ? ` - ${item?.description}` : ''}
${item['x-run-in-apifox'] ? `    //直达链接 :${item['x-run-in-apifox']}` : ''}
`;
                        //parameters参数
                        let queryInfo = ``
                        //注释 中文名+示例
                        let remark = ``
                        //注释 key+中文名+示例
                        let keyRemark = ``
                        let num = 0

                        item.parameters.forEach((i, index) => {
                                queryInfo +=
                                    `        ${/-/.test(i.name) ? "'" : ""}${i.name}${/-/.test(i.name) ? "'" : ""}${i.required ? ':' : '?:'} ${typeMapping[i.schema.type]}
`
                            //js备注
                            if (index) {
                                keyRemark +=
                                    `    // ${i.name}: ${typeMapping[i.schema.type]} ${i.description}${i.examples ? `   示例:${i.examples}` : ''}
`
                            } else {
                                keyRemark +=
                                    `// ${i.name}: ${typeMapping[i.schema.type]} ${i.description}${i.examples ? `   示例:${i.examples}` : ''}
`
                            }


                            remark += `// ${i.description}${i.examples ? `   示例:${i.examples}` : ''}`
                        })

                        if (findSchemaValue(item).required) {
                            for (const key in findSchemaValue(item).properties) {
                                let i = findSchemaValue(item).properties[key]
                                    queryInfo +=
                                        `        ${/-/.test(key) ? "'" : ""}${key}${/-/.test(key) ? "'" : ""}${findSchemaValue(item).required.includes(key) ? ':' : '?:'} ${typeMapping[i.type]}  ${i.description ? `// ${i.description}${i.examples ? `   示例:${i.examples}` : ''}` : ''}
`
                                //js备注
                                if (num) {
                                    keyRemark +=
                                        `    // ${key}: ${typeMapping[i.type]} ${i.description}${i.examples ? `   示例:${i.examples}` : ''}
`
                                } else {
                                    keyRemark +=
                                        `// ${key}: ${typeMapping[i.type]} ${i.description}${i.examples ? `   示例:${i.examples}` : ''}
`
                                }
                                num++
                            }
                        }

                        let requestName = formatString(path) + method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()

                        //有参数
                        if (queryInfo) {
                            //路径传参
                            if (path.includes('{') || path.includes('}')){
                                //ts语法
                                if (isTsSyntax){
                                    tsContent +=
                                        `    ${requestName}: (${extractVariablesAndFormatPath(path, item).variables}) => {
    return Request.${method}(\`${extractVariablesAndFormatPath(path, item).formattedPath}\`);   ${remark.includes('undefined') ? '' : remark}
  },

`
                                }else{
                                    tsContent +=
                                        `    ${keyRemark.slice(0, -1)}
${requestName}: (${extractVariablesAndFormatPath(path, item).jsDateString}) => {
    return Request.${method}(\`${extractVariablesAndFormatPath(path, item).formattedPath}\`);
  },

`
                                }
                            }else{
                                //普通传参
                                //ts语法
                                if (isTsSyntax){
                                    tsContent +=
                                        `    ${requestName}: (data: {
`
                                    tsContent += queryInfo
                                    tsContent +=
                                        `  }) => {
    return Request.${method}(\`${path}\`, data);
  },

`
                                }else{
                                //js语法
                                    tsContent +=
                                        `    ${keyRemark.slice(0, -1)}
    ${requestName}: (data) => {
        return Request.${method}(\`${path}\`, data);
  },

`
                                }

                            }

                        }else{
                            //无参数
                            tsContent +=
                                `    ${requestName}: () => {
        return Request.${method}(\`${path}\`);
    },
    
`
                        }

                }

                }
            }

            tsContent += `};\n`;

            fs.writeFileSync(tsFilePath, tsContent);
        }
    });


    function extractVariablesAndFormatPath(path,info) {
        // 使用正则表达式匹配花括号内的内容
        const regex = /{([^}]+)}/g;
        let variables = '';
        const formattedPath = path.replace(regex, (match, variable) => {
            return `\${${variable}}`;
        });

        let jsDate = ''

        info.parameters.forEach(i => {
                variables += `${i.name}: ${typeMapping[i.schema.type]} ,`
            jsDate += `${i.name} ,`
        })

        const jsDateString = jsDate.slice(0, -2)
        const variablesString = variables.slice(0, -2)
        return {
            jsDateString,
            variables: variablesString,
            formattedPath
        };
    }

    function formatString(input) {
        // 使用正则表达式提取所有英文单词
        const words = input.match(/[a-zA-Z]+/g) || [];

        // 将除了第一个单词以外的单词首字母大写
        const formattedWords = words.map((word, index) => {
            if (index === 0) {
                return word.toLowerCase(); // 第一个单词全部小写
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(); // 其余单词首字母大写
        });

        // 拼接成最终的字符串
        return formattedWords.join('');
    }

    function findSchemaValue(obj) {
        // 如果输入不是对象或数组，直接返回 undefined
        if (typeof obj !== 'object' || obj === null) {
            return undefined;
        }

        // 如果当前对象有键为 'schema'，直接返回其值
        if (obj.hasOwnProperty('schema')) {
            return obj.schema;
        }

        // 遍历对象的每个属性
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                // 如果属性值是对象或数组，递归查找
                if (typeof value === 'object' && value !== null) {
                    const result = findSchemaValue(value);
                    if (result !== undefined) {
                        return result; // 如果找到，直接返回结果
                    }
                }
            }
        }

        // 如果遍历完都没有找到，返回 undefined
        return undefined;
    }

}

// 显示支持的指令列表
program
    .command('ls')
    .description('显示当前支持的指令列表')
    .action(() => {
        console.log('指令列表:');
        console.log('  lchao create - 生成新项目到当前目录');
        console.log('  lchao clear  - 清理当前目录下的 node_modules 和 package-lock.json');
        console.log('  lchao bind git - 绑定线上仓库地址到当前项目');
        console.log('  lchao create-api - 生成 API 请求文件');
        console.log('  lchao ls     - 显示当前支持的指令列表');
    });

// 解析命令行参数
program.parse(process.argv);
