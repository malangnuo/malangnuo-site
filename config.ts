interface Config {
    site_title: string;
    site_description: string;
    site_tagline: string;
    avatar: string;
    author: string;
    author_description: string;
    github: string;
    email: string;
    email_subject: string;
    emailLink: string;
}

const config: Config = {
    site_title: '말랑누오의 기록',
    site_description: '',
    site_tagline: '',
    avatar: '/avatar.webp',
    author: '말랑누오',
    author_description: '누오처럼 살고 싶어 \n말랑하게 정리해보는 이야기들',
    github: 'https://github.com/malangnuo',
    email: 'choiboyuna@gmail.com',
    email_subject: 'To.말랑누오',
    get emailLink(): string {
        return `mailto:${this.email}?subject=${this.email_subject}`;
    },
};

export default config;
