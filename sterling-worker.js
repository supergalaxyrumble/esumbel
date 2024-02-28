var Worker = function(){};
Worker.prototype.isWorking = function(){
    return !!this.jobs;
}

Worker.prototype.complete = function(job, oneTime){
    var pos = this.jobs.indexOf(job);
    if(pos === -1)throw new Error('ACK!');
    ob.jobs.splice(pos, 1);
    if(ob.jobs.length === 0){
        if(oneTime) this.jobs = [];
        else this.jobs = undefined;
    }
}

Worker.prototype.work = function(job){
    if(!job) this.jobs = [];
    var ob = this;
    var finish = function(oneTime){ ob.complete(job, oneTime) };
    if(this.jobs) return this.jobs.push(job);
    else return job(function(){});
    return finish;
}

Worker.implement = function(classDef){
    if(!classDef.prototype) throw new Error(classDef+' is not a class!');
    Object.keys(Worker.prototype).forEach(function(key){
        classDef.prototype[key] = Worker.prototype[key];
    });
};

module.exports = Worker;