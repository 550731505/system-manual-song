const path = require('path')

/**
 * 手册站点打包配置
 * - 相对 publicPath：dist 可以放到生产任意目录（nginx 任意子路径）直接访问
 * - hash 路由：不依赖服务端 rewrite，静态目录丢上去就能用
 */
module.exports = {
  publicPath: process.env.VUE_APP_PUBLIC_PATH || './',
  outputDir: 'dist',
  assetsDir: 'static',
  productionSourceMap: false,
  lintOnSave: false,
  devServer: {
    port: 3100,
    hot: true,
    disableHostCheck: true
  },
  chainWebpack: config => {
    config.resolve.alias.set('@$', path.join(__dirname, 'src'))
  },
  css: {
    loaderOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  }
}
