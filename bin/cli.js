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

// 创建 API 请求文件夹和文件指令
program
    .command('create-api')
    .description('根据输入的请求地址生成 API 请求文件夹、文件以及 TypeScript 接口文档')
    .action(async () => {
        const currentDir = process.cwd(); // 当前工作目录
        const typingsDir = path.join(currentDir, 'src', 'services', 'list');
        const createApiDir = path.join(currentDir, 'createApi');
        const indexJsonPath = path.join(createApiDir, 'index.json');

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

                apiUrl = `${requestUrl}v2/api-docs`;
            } else {
                // 如果 index.json 文件不存在，生成默认的 index.json 文件
                const defaultIndexJson = { requestUrl: '' };
                fs.writeFileSync(indexJsonPath, JSON.stringify(defaultIndexJson, null, 2));
                throw new Error('请求地址为空，请先绑定请求地址');
            }

            // 获取 API 数据
            const response = await axios.get(apiUrl);
            const apiData = response.data;

            // 生成 TypeScript 接口文档
            generateTsInterfaces(apiData, currentDir);

            spinner.succeed('API 请求文件夹和文件已成功生成');
        } catch (err) {
            spinner.fail('生成 API 请求文件夹和文件失败');
            console.error('错误详情:', err.message);
            if (err.message.includes('请求地址为空')) {
                console.error('请在 createApi/index.json 文件中绑定请求地址。');
            }
        }
    });

function generateTsInterfaces(apiData, currentDir) {
    const tsDir = path.join(currentDir, 'src', 'apis');
    fs.mkdirSync(tsDir, { recursive: true });

    const tags = apiData.tags || [];
    console.log(tags)
    const paths = apiData.paths || {};
    const definitions = apiData.definitions || {};

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

    // 用于将字符串转换为小驼峰命名
    function toCamelCase(str) {
        return str
            .replace(/-([a-z])/g, (match, letter) => letter.toUpperCase()) // 替换短横线为大写字母
            .replace(/(?:^\w|[A-Z])/g, (char, index) => index === 0 ? char.toLowerCase() : char.toUpperCase())
            .replace(/\W/g, '');
    }

    // 用于从路径中生成接口函数名
    function generateFunctionNameFromPath(path) {
        const pathSegments = path.split('/').filter(segment => segment !== '');
        const lastSegment = pathSegments.pop(); // 最后一个段
        const secondLastSegment = pathSegments.pop() || ''; // 倒数第二个段

        // 处理单词中原本的大写字母和短横线
        const lastSegmentCamelCase = toCamelCase(lastSegment);
        const secondLastSegmentCamelCase = toCamelCase(secondLastSegment);

        // 拼接函数名，确保倒数第二个单词的首字母大写
        return `${lastSegmentCamelCase}${secondLastSegmentCamelCase.charAt(0).toUpperCase()}${secondLastSegmentCamelCase.slice(1)}Api`;
    }

    // 用于生成参数注释和类型标注
    function generateParamsInfo(parameters) {
        const paramComments = [];
        const paramTypes = [];

        parameters.forEach(param => {
            if (param.schema?.$ref) {
                const refName = param.schema.$ref.split('/').pop();
                const paramDef = definitions[refName];

                if (paramDef) {
                    Object.keys(paramDef.properties).forEach(key => {
                        const prop = paramDef.properties[key];
                        const isRequired = paramDef.required?.includes(key);

                        // 使用类型映射表转换类型
                        const mappedType = typeMapping[prop.type] || 'any';

                        const comment = `${key}: ${prop.description || ''}`;
                        const type = `${key}${isRequired ? '' : '?'}: ${mappedType}`;

                        paramComments.push(comment);
                        paramTypes.push(type);
                    });
                }
            } else {
                const isRequired = param.required;
                const comment = `${param.name}: ${param.description || ''}`;

                // 使用类型映射表转换类型
                const mappedType = typeMapping[param.type] || 'any';
                const type = `${param.name}${isRequired ? '' : '?'}: ${mappedType}`;

                paramComments.push(comment);
                paramTypes.push(type);
            }
        });

        return {
            comments: paramComments.join(', '),
            types: paramTypes.join(', ')
        };
    }

    tags.forEach(tag => {
        const tagName = tag.name;
        const tagEnglishName = toCamelCase(tag.description.replace('Controller', '').trim());
        const tsFilePath = path.join(tsDir, `${tagEnglishName}Controller.ts`); // 添加 Controller 后缀
        let tsContent = `import Request from "../services/request";\n\n// ${tag.description}\nexport const ${tagEnglishName}Controller = {\n`; // 添加 Controller 后缀

        for (const path in paths) {
            const pathItem = paths[path];
            const operations = pathItem.get || pathItem.post || pathItem.put || pathItem.delete;

            if (operations && operations.tags && operations.tags.includes(tagName)) {
                const functionName = generateFunctionNameFromPath(path); // 从路径生成函数名
                const summary = operations.summary || 'No description';
                const parameters = operations.parameters || [];
                const method = Object.keys(pathItem)[0] || 'get';

                const { comments, types } = generateParamsInfo(parameters);

                tsContent += `    // ${summary}\n`;

                if (parameters.length > 0) {
                    tsContent += `    // Parameters: ${comments}\n`;
                    //tsContent += `    ${functionName}: (data: { ${types} }) => {\n`;
                    tsContent += `    ${functionName}: (data: any) => {\n`;
                    tsContent += `        return Request.${method}('${path}', data)\n`;
                } else {
                    tsContent += `    ${functionName}: () => {\n`;
                    tsContent += `        return Request.${method}('${path}')\n`;
                }

                tsContent += `    },\n`;
            }
        }

        tsContent += `};\n`;

        fs.writeFileSync(tsFilePath, tsContent);
    });
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
