import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import { chromeRemoteDebugUrl, listPrefix } from './conf';
import EventEmitter from 'events';

enum State {
    None, List, Detail
}

interface Spider {
    on(event: 'close', callback: () => void): this;
    on(event: 'findPic', callback: (url: string, uid: string, cate: string) => void): this;
    on(event: 'picReady', callback: () => void): this;
}

class Spider extends EventEmitter {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private bloggerId: String = '';
    private filter: RegExp | null = null;
    private state: State = State.None;
    constructor() {
        super();
    }
    async init() {
        const wsChromeEndpointurl: string = await fetch(chromeRemoteDebugUrl).then(res => res.json()).then(data => data.webSocketDebuggerUrl);
        this.browser = await puppeteer.connect({
            browserWSEndpoint: wsChromeEndpointurl
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            width: 400,
            height: 700,
            isMobile: true
        });
        await this.page.setUserAgent('Mozilla/5.0 (Linux; Android 9; V1901A Build/P00610; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36 VivoBrowser/8.1.14.2');
        this.setResponse(this.page);
    }

    // 解析请求
    private setResponse(page: puppeteer.Page) {
        page.on('response', async (response) => {
            // https://m.weibo.cn/profile/info?uid=2168613091
            if (this.state == State.List && response.url().includes('m.weibo.cn/profile/info?')) {
                const json: any = await response.json();
                const url: string | void = this.findDetail(json);
                if (url) {
                    console.log(`Detail Page: ${url}`);
                    // this.getDetail(url);
                } else {
                    this.emit('close');
                }
            }
        });
    }

    // 获取卡片内部信息
    private findDetail(json: any): string | void {
        for (let i = 0; i < json?.data?.statuses?.length; i++) {
            const page = json.data.statuses[i];
            if (this.filter?.test(page?.page_info?.page_title)) {
                // 仅抓取图片
                if (page.pics) {
                    page.pics.forEach((element: any) => {
                        const url = element.large.url;
                        this.emit('findPic', url, this.bloggerId);
                    });
                } else if (page.pic) {
                    this.emit('findPic', page.pic.url, this.bloggerId);
                }
                return `https://m.weibo.cn/detail/${page.mid}`;
            }
        }
    }

    // 设置抓取ID、规则
    async set(bloggerId: Spider["bloggerId"], filter: Spider["filter"]) {
        this.bloggerId = bloggerId;
        this.filter = filter;
        return this;
    }

    // 开始抓取
    async fire() {
        this.state = State.List;
        await this.page?.goto(listPrefix + this.bloggerId, {
            waitUntil: 'networkidle2'
        });
    }

    static async main() {
        const spider = new Spider();
        await spider.init();

    }
}