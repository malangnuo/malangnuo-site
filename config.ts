interface Config {
    site_title: string;
    site_tagline: string;
    site_tagline2: string;
    avatar: string;
    author: string;
    author_description: string;
    linkedin: string;
    email: string;
    email_subject: string;
    emailLink: string;
}

const config: Config = {
    site_title: '말랑누오의 기록',
    site_tagline: '누오처럼 살고 싶어',
    site_tagline2: '말랑하게 정리해보는 이야기들',
    avatar: '/avatar.webp',
    author: '말랑누오',
    author_description: '언제나 여유롭고 말랑한 누오를 좋아합니다.',
    linkedin: 'www.linkedin.com/in/by-choi',
    email: 'choiboyuna@gmail.com',
    email_subject: 'To.말랑누오',
    get emailLink(): string {
        return `mailto:${this.email}?subject=${this.email_subject}`;
    },
};

export default config;
