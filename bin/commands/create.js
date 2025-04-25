import fs from 'fs';
import degit from 'degit';
import ora from 'ora'; // 引入 ora 进行 loading 效果
import inquirer from 'inquirer';

export default async function create() {
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
}
