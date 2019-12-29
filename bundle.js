/**
 * 模块打包器将小的程序段编译成浏览器可以执行的更大更复杂的程序。
 * 这些小块仅仅是Javascript文件和模块之间的依赖。
 * （https://webpack.js.org/concepts/modules）。
 * 
 * 模块打包器有一个入口文件的概念。代替在浏览器中添加一些脚本标签
 * 并且让他们运行，我们告诉打包器哪个文件是应用的主文件，这是引导
 * 整个应用程序的文件。
 * 
 * 我们的打包器将从这个入口文件开始，它尝试去理解文件直接的依赖。
 * 然后，它尝试去理解文件依赖的依赖。它会持续的这么做直到算出应用
 * 的每个模块以及和其他模块的依赖关系。
 * 
 * 这种理解工程的方式称为 dependency graph(依赖关系图).
 * 
 * 在这个例子里，我们讲创建一个依赖关系图并且将它的所有模块打包到
 * 一个包里。
 * 
 * 让我们开始吧
 * 
 * 请注意：这是一个非常简单的例子。像依赖循环、捕获模块导出，解析
 * 每个模块我们仅仅处理一次，以便让例子尽可能的简单。
 */


const fs = require('fs')
const path = require('path')
const babylon = require('babylon')
const traverse = require('babel-traverse').default
const babel = require('babel-core')

let ID = 0;
// 我们从创建一个函数开始，它会接受一个文件路径，读取它的内容
// 并且取出它的依赖
function createAsset(filename) {
  // 读取文件内容作为一个字符串
  const content = fs.readFileSync(filename, 'utf-8');

  // 现在，我们尝试计算出这个文件所依赖的文件。我们可以通过它的字符串导入
  // 的方式来查看。然后，这是笨方法，因此，我们可以使用一个JavaScript解析器。
  //
  // JavaScript解析器是一个可以读取和理解JavaScript代码的工具。它可以
  // 帮我们把代码生成一个更抽象的模型称为AST(abstract syntax tree--抽象语法树)。
  //
  // 我强烈建议你使用AST Explorer（http://astexplorer.net）看看AST的样子。
  // AST 包含了我们代码的很多信息。我们可以通过查询它来理解我们的代码试图做什么。
  const ast = babylon.parse(content, {
    sourceType: 'module',
  });

  // 这个数组将管理这个模块所依赖的模块的相对路径
  const dependencies = [];

  // 我们遍历AST，试图理解这个模块依赖了哪些模块，为此，
  // 我们检查AST上的每一个重要声明。
  traverse(ast,{
    // EcmaScript 模块是相当容易的，因为他们是静态的。这意味着你并不需要导入一
    // 个变量， 或可选的导入另一个模块。每次我们看到一个导入声明，我们仅仅接纳
    // 它的值作为一个依赖.
    ImportDeclaration:({node})=> {
      // 我们把这个值放进一个依赖数组中。
      dependencies.push(node.source.value);
    },
  });
  // 通过创建一个简单的累加器，我们为这个模块分配一个唯一标识符。
  const id = ID++;
  // 我们使用的ECMASript模块和其他的JavaScript功能可能并没有被所有的浏览器支持。
  // 为了确保我们的包在所有的浏览器都可以运行，我们将用babel转换它
  //（看https://babeljs.io）
  //
  // ‘presets’操作性是一个规则集合，它告诉babel怎么样转换我们的代码。我们用
  // ‘babel-preset-env’来把我们的代码转换成大多数浏览器可以运行的代码。
  const {code} = babel.transformFromAst(ast, null, {
    presets: ['env'],
  });

  // 返回关于这个模块的所有信息
  return {
    id,
    filename,
    dependencies,
    code,
  };
}

// 现在我们能够提取一个模块的依赖，我们会继续提取入口文件的依赖。
//
// 然后，我们继续提取它的依赖的每一个依赖。我们依次进行直到计算出
// 应用程序的每一个依赖并且他们如何依赖其他的模块。这个理解过程称
// 依赖图。
function createGraph(entry) {
  // 从解析依赖的入口文件开始
  const mainAsset = createAsset(entry);

  // 我们使用一个队列去解析每一个资源的依赖。为此我们使用入口资源
  // 定义一个数组。
  const queue = [mainAsset];
  // 我们使用一个‘for ... of’循环去迭代这个队列。最初的队列只有
  // 一个资源，但是随着我们的迭代它将加入新资源到队列中。当队列为
  // 空循环终止。
  for(const asset of queue) {
    // 我们的每一个资源有它所依赖的模块的相对路径列表。我们要对他
    // 们进行迭代，解析他们用我们的‘createAsset()’函数，追踪这
    // 个模块在此对象中的依赖。
    asset.mapping = {};
    // 这是这个模块所在的目录
    const dirname = path.dirname(asset.filename);
    // 我们遍历其依赖项的相对路径列表。
    asset.dependencies.forEach(relationPath => {
      // 我们的‘createAsset()’函数希望一个绝对路径。依赖数组是
      // 一个相对路径依赖数组。这些路径相对于导入他们的文件。我们
      // 通过加入他的父资源的目录路径可以把它的相对路径转换为绝对
      // 路径。
      const absolutePath = path.join(dirname, relationPath);
      // 解析资源，读取它的内容，提取它的依赖。
      const child = createAsset(absolutePath);
      // 知道资源所依赖的'子资源'对我们来说是必要的。我们通过给
      // 'mapping'对象用子资源的id添加一个新属性来表达这种关系。
      asset.mapping[relationPath] = child.id;

      // 最后，我们添加子资源到我们的队列，因此它的依赖项也将被迭
      // 代和解析。
      queue.push(child);
    });
  }

  // 此时，队列只是包含目标应用程序中每个模块的组数。
  return queue;
}

// 接下来，我们定义一个函数，将使用我们的依赖图并且返回一个浏览器可以
// 运行的包。
// 
// 我们的包仅仅是一个自我调用的函数：
//
// (function() {})()
//
// 函数将接收仅仅一个参数：携带我们关系图中每一个模块信息的对象
function bundle(graph) {
  let modules = '';

  // 在我们得到我们的函数体之前，我们讲构造这种参数。请注意我们
  // 正在构建的这个字符串被两个花括号包装。因此对于每一个模块，
  // 我们添加一个这种形式的字符串：‘key:value’。
  graph.forEach(mod => {
    // 关系图中的每一模块在这个对象中都有一个入口。我们使用模块
    // id作为key，使用一个数组作为值（我们的每个模块有两个值）
    //
    // 第一个值是用函数封装的每一个模块的代码，这是因为模块的作
    // 用域应该是：在一个模块中定义的变量不应该影响其他的作用域
    // 或全局作用域。
    //
    // 我们的模块，我们转换他们之后，使用CommonJS 模块系统：
    // 他们希望一个‘require’，一个‘module’和一个'exports'
    // 对象可用。这些在浏览器中通常是不可用的，因此我们将实现
    // 他们并且把他们注入我们的函数封装器。

    // 对于第二个值，我们字符串化了模块和它的依赖之间的映射。这
    // 是一个对象，看起来像这样：
    // {'./relative/path':1 }。
    // 
    // 这是因为被转换的模块代码以及调用了携带相对路径的‘require’.
    // 当这个函数被调用时，我们应该能够知道和模块一致的这个模块的
    // 相对路径。
    modules +=  `${mod.id}: [
       function (require, module, exports) {
         ${mod.code}
       },
        ${JSON.stringify(mod.mapping)},
     ],`;
  })

  // 最后，我们实现这个自我调用函数。
  //
  // 我们通过创建‘require()’函数开始：它接受一个模块id并且查找它
  // 在我们之前构造的模块对象。我们讲解构我两个值的数组来得到我们的
  // 函数封装器和映射对象。
  //
  // 我们的模块代码调用携带相对路径的‘require()’代替模块的id。我
  // 们的require函数需要模块ids。此外，两个模块可能‘require()’
  // 相同的相对路径但意味着不同的模块。
  //
  // 为了处理这个，但一个模块被需要的时候我们创建一个新的，使用专用
  // 的‘require’函数让它去使用。它将特定于该模块，并且知道如何使用
  // 模块的映射对象转换相对路径为模块的映射对象。
  //
  // 最后，用CommonJS，当一个模块被需要时，它能够通过可变的它的
  // ‘exports’导出它的值.'exports'对象，它通过模块代码更改之后，
  // 被通过'require()'函数返回。
  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(relationPath) {
          return require(mapping[relationPath]);
        }

        const module = { exports: {} };

        fn(localRequire,module,module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;
  
  // 我们只是返回结果，OK！
  return result;
}

const graph = createGraph('./example/entry.js');
const result = bundle(graph);

console.log(result);
