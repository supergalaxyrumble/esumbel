var art = require('ascii-art');
art.Figlet.fontPath = 'Fonts/';
var pkg = require(process.cwd()+'/package.json');
var yargs = require('yargs');
var fs = require('fs');
var resolve = require('path').resolve;

function valueAt(root, name, value){
    if(!Array.isArray(name)) return valueAt(root, name.split('.'), value);
    var can = name.shift();
    if(name.length == 0){
        //setting
        if(value) root[can] = value;
        //deep return;
        return root[can];
    }
    //path DNE on set
    if(!root[can] && value) root[can] = {};
    //path DNE on get
    if(!root[can]) throw new Error('field '+can+' does not exist on '+root);
    //traversing
    return valueAt(root[can], name, value);
}

var isEnvVariable = function(name){
    return name && name.substring(0, 1) === '$';
}
var envVariable = function(name){
    return process.env[name.substring(1)];
}

var Loader = function(defaultConfig){
    this.package = pkg;
    this.configuration = defaultConfig || this.package['app-config'] || {};
    this.yargs = yargs;
    this.configPostProcessors = [];
    this.yargs.alias('c', 'config')
        .nargs('c', 1)
        .describe('c', 'config file to use');
    this.arg('p', 'port', 'http port', 'port', 8080);
}


Loader.prototype.support = function(list){
    var ob = this;
    var controls = {
        database : function(name){
            if(name === true){ //compatibility mode
                ob.arg('a', 'mysql-password', 'MySQL password', 'servers.mysql.password');
                ob.arg('d', 'mysql-ip', 'MySQL host', 'servers.mysql.host');
                ob.arg('o', 'mysql-port', 'MySQL port', 'servers.mysql.port', 3306);
                ob.arg('u', 'mysql-user', 'MySQL user', 'servers.mysql.user');
            }else{
                var db = name || 'database';
                var a = function(k, s){ ob.arg(k, db+'-'+s, db+' '+s, db+'.'+s) };
                a('a', 'password');
                a('d', 'host');
                a('o', 'port');
                a('u', 'user');
            }
        },
        mapbox : function(name){
            ob.arg('m', 'mapbox-key', 'use the provided mapbox key', 'mapbox.key');
        },
        zillow : function(name){
            ob.arg('z', 'zillow-key', 'use the provided zillow key', 'zillow.key');
        }
    };
    if(list){
        if(typeof list === 'string') list = list.split(',').map(function(s){
            return s.trim();
        });
        list.forEach(function(control){
            controls[control]();
        })
    }
    return controls;
}

Loader.prototype.arg = function(letter, name, description, config, defaultValue){
    this.yargs.alias(letter, name).nargs(letter, 1).describe(letter, description);
    var ob = this;
    if(config){
        this.configPostProcessors.push(function(rootConfig){
            var argv = ob.yargs.argv;
            if(argv[letter]) valueAt(rootConfig, config, argv[letter]);
            var value;
            try{
                value = valueAt(rootConfig, config);
            }catch(e){ }
            if(typeof value === 'string' && isEnvVariable(value)){
                valueAt(rootConfig, config, envVariable(value));
            }
            if(defaultValue && !value) valueAt(rootConfig, config, defaultValue);
        });
    }

}

Loader.prototype.config = function(config){
    var argv = this.yargs.argv;
    var data = (argv.c || config)?
        typeof config == 'string'?
            JSON.parse(fs.readFileSync(resolve(process.cwd()+'/'+config)).toString()):
            config
        :{};
    this.configPostProcessors.forEach(function(postProcessor){
        postProcessor(data);
    });
    return data;
}


//all we need in our service modules is
// if(require.main === module) Loader.load(module.exports);
Loader.prototype.load = function(App){
    var Application = App;
    var argv = this.yargs.argv;
    if(!app){
        var service = argv.s || 'service';
        Application = require(process.cwd()+'/' + service);
    }
    //todo: interleave defaultConfig and config File?
    var config = this.config(this.yargs.argv.c || this.configuration);
    var app = new Application(config);
    app.serve(config.port);
    art.font(this.package.name, 'cyberlarge', 'cyan', function(name){
        var target = (argv.c && argv.c.split('/').pop()) ||
            '<package.json>.app-config';
        art.font(target, 'cyberlarge', 'cyan', function(role){
        	console.log(name);
            console.log(role);
        	console.log(pkg.description);
        	console.log('['+art.style(' ready ', 'green', true)+']=[ @'+
        	   art.style(' localhost ', 'white', true)+']=['+
        	   art.style(' port '+config.port+' ', 'white', true)+']');
        });
    });
}

// drop in replacement
// if(require.main === module) Loader.legacyLoader(module.exports);
Loader.legacyLoader = function(App){
    var loader = new Loader();
    loader.yargs.usage('Usage: $0 <command> [options]')
        .command('appserve', 'Run the appserver')
        .example('$0 -m <mapbox key> -z <zillow key>', 'run using the provided keys')
        .example('$0 -c ~/my/config.json', 'run using the data in the config file')
        .help('h').alias('h', 'help')
        .epilog('copyright '+(new Date()).getFullYear())
    var support = loader.support();
    support.database(true);
    support.mapbox();
    if(App) loader.load(App);
    return loader;
}

module.exports = Loader;
