export interface Event
{
    id: string;
    userId: string;
    title: string;
    description: string;
    date: Date;
    time: string;
    location: string;
    imageUrl: string;
    slug: string;
    createBy: string;
    createdAt: Date;
    updatedAt: Date;
}