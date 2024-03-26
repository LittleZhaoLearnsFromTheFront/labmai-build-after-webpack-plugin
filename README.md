# 使用

## config.yaml配置

1. config.yaml配置后，可以在发版时免输账号和密码
2. config.yaml需要放在项目的根目录下

config.yaml 使用方法如下

```
USER: xxxxx //开发环境的用户名
PRODUSER: xxxxxx //生产环境的用户名
PRODPASSWORD: xxxxxx //生产环境的密码
```



## 使用方式

需要在webpack.config.js中配置

```
plugins:[
	new LabmaiBuildAfterWebpackPlugin({
		//配置
	})
]

chainwebpack:(chain)=>{
	chainWebpackLabmaiBuildAfter(chain,{
		//配置
	})
}
```



## 插件配置

```typescript
{
	 type:['development','production'] //发布时开发环境、生产环境使用 默认全部使用
   customDevPaths?: { //自定义开发环境发布脚本，当有customDevPaths时devPaths将会失效
   		name:string
  		path:string //发布脚本或发布脚本的地址  执行脚本会传入 -u 用户名  如需使用可以使用getopts接收
	 }[], 
   customProdPaths?: { //自定义开发环境发版脚本，当有customProdPaths时prodPaths将会失效
   		name:string
  		path:string //发版脚本或发版脚本的地址  执行脚本会传入 -u 用户名 -p 密码 -r 脚本路径  如需使用可以使用getopts接收
	 },
}
```

