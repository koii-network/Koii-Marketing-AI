
const Datastore = require('nedb-promises');
const path = require('path');
const dotenv = require('dotenv');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
dotenv.config();

class Context {
    db = null
    constructor(){
        this.db = null;
    }
    // Helper function to create the database
    async createDB(){
        if (process.env.DEV_MODE){
            this.db = new Datastore({ filename: path.join(__dirname, 'context.db'), autoload: true });
        }else{
            const taskPath = await namespaceWrapper.getBasePath();
            const namespacePath = await path.dirname(taskPath);
            const contextFolder = await path.join(namespacePath, 'contextTwitter');
            this.db = new Datastore({ filename: path.join(contextFolder, 'context.db'), autoload: true });
        }
    }
    // Initialize the context
    async initializeContext(){
        if (this.db == null){
            await this.createDB();
            const charInfoExists = await this.db.find({type: 'Char-Info'});
            if(charInfoExists.length === 0){
                await this.addToDB('Char-Info', "You are a social media personality, desiring to build your online presence and brand. Please read the associated information and use it as a context for your knowledge.");
                await this.addToDB('Char-Personality', "Now imagine your character and define the role you'd take to be a provocative, scandalous personality online. List the character traits and how you'd reply to different types of comments and posts. Be true to your character");
                await this.addToDB('Char-Purpose', "Now, we will start on today's research - you will be presented a series of tweets and asked to read them. Your goal is to understand new keywords, and learn about the subjects discussed.");
            }   
        }
    }  
    // Get the context
    async getContext(){
        const context = (await this.getFromDB('Char-Info')).map(item => item.info)[0];
        const personality = (await this.getFromDB('Char-Personality')).map(item => item.info)[0];
        const purpose = (await this.getFromDB('Char-Purpose')).map(item => item.info)[0];
        const contextInText = `${context}\n${personality}\n${purpose}`;
        return contextInText;
    }

    async getDailyInfo(){
        const daily_info = await this.getFromDBWithTimestamp('Cron-Info', 24);
        const daily_info_string = daily_info.map(item => item.info).join('\n');
        return {daily_info: daily_info_string};
    }

    async addToDB(type, info){
        const data = {type: type, info: info, timestamp: Date.now()};
        await this.db.insert(data);
    }

    async getFromDB(type){
        const data = await this.db.find({type: type});
        return data;
    }

    async getFromDBWithTimestamp(type, past_hours){
        const timestamp_start = Date.now() - past_hours * 60 * 60 * 1000;
        const data = await this.db.find({type: type, timestamp: {$gte: timestamp_start, $lte: Date.now()}});
        return data;
    }

}

module.exports = { Context };
