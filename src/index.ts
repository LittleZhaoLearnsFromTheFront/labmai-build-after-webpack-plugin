import { exec, spawn } from 'child_process'
import {
    blue,
    green,
    yellow,
    magenta,
    cyan,
    red,
    lightGreen
} from 'kolorist'
import prompts from 'prompts'
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';

export enum LabmaiBuildAfterType {
    Development = 'development',
    Production = 'production'
}
type TypePaths = {
    name: string,
    path: string,
}
export type Options = {
    type?: LabmaiBuildAfterType[],
    customDevPaths?: TypePaths[], //自定义发版
    customProdPaths?: TypePaths[],
}

export enum Template {
    USER = '{USER}',
    PRODUSER = '{PRODUSER}',
    PRODPASSWORD = '{PRODPASSWORD}'
}

const rejectInfo = {
    value: 'reject',
    title: red('否'),
}
const defaultPluginName = 'labmai-build-after-webpack-plugin'
const defaultDevUser = "$USER"
const isShellCommand = (str: string) => {
    // 检查是否包含空格，作为shell命令的一般性分隔符
    return /\s+/.test(str);
}

const sleep = (time: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

const temolateReplace = (shell: string, replaceTemplate: { [key in Template]: string }) => {
    Object.entries(Template).forEach(([_, value]) => {
        if (shell.includes(value)) {
            shell = shell.replaceAll(value, replaceTemplate[value])
        }
    })
    return shell
}
export class LabmaiBuildAfterWebpackPlugin {

    private colors = [blue, green, yellow, magenta]
    private config = {
        user: defaultDevUser,
        prodUser: "",
        prodPassword: ""
    }
    private options: Options = {
        type: [LabmaiBuildAfterType.Development, LabmaiBuildAfterType.Production],
        customDevPaths: [],
        customProdPaths: []
    }


    constructor(options?: Options) {
        this.options = { ...this.options, ...options }
    }

    apply(compiler: any) {
        const isProduction = process.env.NODE_ENV === 'production' || compiler.options.mode === 'production'
        const { type, customDevPaths, customProdPaths } = this.options
        const hasDevType = !!type?.includes(LabmaiBuildAfterType.Development)
        const hasProdType = !!type?.includes(LabmaiBuildAfterType.Production)

        const canExec = type?.length && isProduction

        this.readConfigYaml()
        const replactTemplate = (user?: string, prodUser?: string, prodPassword?: string) => ({ [Template.USER]: user || this.config.user, [Template.PRODUSER]: prodUser || this.config.prodUser, [Template.PRODPASSWORD]: prodPassword || this.config.prodPassword })

        //push:erguotou
        compiler.hooks.shutdown.tapAsync(defaultPluginName, async (next: Function) => {
            //只有生产环境试用
            if (!canExec) return next()
            //dev
            if (!hasDevType || !customDevPaths?.length) return next()
            const mapDevPaths = customDevPaths
            const newDevPaths = mapDevPaths?.map((t, i) => ({ ...t, color: this.colors[i % 4] })) ?? []
            await sleep(1500)
            const { devPath }: { devPath: string } = await prompts([
                {
                    name: 'devPath',
                    type: 'select',
                    message: cyan('请选择Dev环境发布地址: '),
                    choices: [...newDevPaths.map(t => ({ value: t.path, title: t.color(t.name) })), rejectInfo]
                }
            ])

            if (devPath === 'reject') return next()

            //如果有自定义则直接使用自定义脚本
            const execShell = isShellCommand(devPath) ? temolateReplace(devPath, replactTemplate()) : `${path.resolve(process.cwd(), devPath)} -u ${this.config.user}`
            console.log("正在发布请耐心等待......");
            //执行脚本
            exec(execShell, (error, stdout) => {
                if (error) {
                    console.log(red("Dev环境脚本执行错误!"));
                    console.log(error);
                    return next()
                }
                console.log(lightGreen("Dev环境发布成功!"));
                console.log(stdout);
                next()
            })
        })

        compiler.hooks.shutdown.tapAsync(defaultPluginName, async (next: Function) => {
            //只有生产环境试用
            if (!canExec) return next()
            //prod
            if (!hasProdType || !customProdPaths?.length) return next()
            const mapProdPaths = customProdPaths
            const newProdPaths = mapProdPaths?.map((t, i) => ({ ...t, color: this.colors[i % 4] })) ?? []
            await sleep(1500)
            const { prodPath, user, password } = await prompts([
                {
                    name: 'prodPath',
                    type: 'select',
                    message: cyan('请选择Prod环境发布地址: '),
                    choices: [...newProdPaths.map(t => ({ value: t.path, title: t.color(t.name) })), rejectInfo]
                },
                {
                    name: 'user',
                    type: this.config.prodUser ? null : "text",
                    message: cyan('请输入您的用户名: '),
                },
                {
                    name: 'password',
                    type: this.config.prodPassword ? null : "text",
                    message: cyan('请输入您的密码: '),
                },
            ])

            if (prodPath === 'reject') return next()

            const newPassword = password || this.config.prodPassword
            const newUser = user || this.config.prodUser

            //如果有自定义则直接使用自定义脚本

            const execShell = isShellCommand(prodPath) ? temolateReplace(prodPath, replactTemplate(undefined, newUser, newPassword)) : `${path.resolve(process.cwd(), prodPath)} -u ${newUser} -p ${newPassword} -r ${prodPath}`

            console.log("正在发布请耐心等待......");
            //执行脚本
            const childProcess = spawn('bash', ['-c', execShell], {
                stdio: ['inherit', 'inherit', 'inherit']
            });
            childProcess.on("error", (err: Error) => {
                console.log(red("Prod环境脚本执行错误!"));
                console.log(err);
                next()
            })

            childProcess.on('exit', () => {
                console.log(lightGreen('Prod环境脚本执行完成!'));
                next()
            });
        })
    }

    readConfigYaml() {
        const configYamlPath = path.resolve(process.cwd(), './labmai.yaml')
        if (fs.existsSync(configYamlPath)) {
            const { USER, PRODUSER, PRODPASSWORD } = YAML.parse(fs.readFileSync(configYamlPath, 'utf8')) ?? {};
            this.setConfig('user', USER || defaultPluginName)
            this.setConfig('prodUser', PRODUSER || "")
            this.setConfig('prodPassword', PRODPASSWORD || "")
        }
    }

    setConfig(key: string, value: string) {
        this.config[key] = value
    }

}


export const chainWebpackLabmaiBuildAfter = (config: any, options?: Options) => {
    config.plugin(defaultPluginName).use(
        LabmaiBuildAfterWebpackPlugin, [
        options
    ])
}

