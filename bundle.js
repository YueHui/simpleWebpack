const fs = require('fs');
const path = require('path');

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

const result = bundle('./src/index.js');
// console.log(result);
if(!fs.existsSync('./dist')){
    fs.mkdirSync('./dist');
}

fs.writeFileSync('./dist/bundle.js',result);
console.log("success");

/**
 * 处理 require 和export 最后返回代码
 * @param {string} file 
 */
function bundle(file){
    const depsGraph = JSON.stringify(parseModules(file));
    return `
(function(graph){
    function require(file){

        function absRequire(relPath){
            return require(graph[file].deps[relPath])
        }

        var exports = {};
        (function(require,exports,code){
            eval(code);
        })(absRequire,exports,graph[file].code)

        return exports;
    }
    require('${file}');
})(${depsGraph});
    `
}

/**
 * 递归依赖
 * @param {string} file 
 */
function parseModules(file){
    const entry = getModuleInfo(file);
    const temp = [entry];

    for(let i=0;i<temp.length;i++){
        const deps = temp[i].deps;
        if(deps){
            for(const key in deps){
                if(deps.hasOwnProperty(key)){
                    temp.push(getModuleInfo(deps[key]));
                }
            }
        }
    }

    //转化格式供后面使用
    const depsGraph = {};
    temp.forEach(moduleInfo=>{
        depsGraph[moduleInfo.file] = {
            deps: moduleInfo.deps,
            code: moduleInfo.code
        }
    })

    // console.log(depsGraph);
    return depsGraph;
}

/**
 * 分析代码
 * @param {sting} file 
 */
function getModuleInfo(file){
    const body = fs.readFileSync(file,'utf-8');

    //转换代码为AST语法树
    const ast = parser.parse(body,{
        sourceType:'module'
    })

    //分析语法树
    const deps = {};
    traverse(ast,{
        ImportDeclaration({node}){
            const dir = path.dirname(file);
            const abspath = './'+ path.join(dir,node.source.value);
            deps[node.source.value] = abspath;
        }
    })

    //用babel转化成es5
    const {code} = babel.transformFromAst(ast,null,{
        presets:['@babel/preset-env']
    })

    return {
        file,
        deps,
        code
    };
}

// getModuleInfo('./src/index.js');