import rss, { pagesGlobToRssItems } from '@astrojs/rss';

export async function GET(context: any) {
    return rss({
        title: "말랑누오 | 말랑누오의 기록",
        description: '',
        site: context.site,
        items: await pagesGlobToRssItems(import.meta.glob('./**/*.md')),
        customData: `<language>en-us</language>`,
    });
}
