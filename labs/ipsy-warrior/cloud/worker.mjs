import {createStore} from './store.mjs';
import {createGame,act,validSave} from '../engine.mjs';
export class IpsySave{
 constructor(ctx){this.handle=createStore(ctx.storage,{createGame,act,validSave});}
 fetch(request){return this.handle(request.headers.get('X-Game-Owner'),request);}
}
export default {fetch(){return new Response('Not found',{status:404});}};
