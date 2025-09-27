// This file has been restored to its full application state and then enhanced with task-expense linking.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// FIX: Import `ReactDOM` from `react-dom` for `createPortal` and `createRoot` from `react-dom/client` for the new root API.
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// Per guidelines, initialize GoogleGenAI with the API key from `process.env.API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- TYPES ---
type Theme = 'light' | 'dark';
type Priority = 'Low' | 'Medium' | 'High';
type TaskStatus = 'Pending' | 'Completed';
type View = 'Dashboard' | 'Tasks' | 'Cash Book' | 'Settings';
type TransactionType = 'Income' | 'Expense';
type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'Bank Transfer';
type Wallet = 'Personal' | 'Business' | 'Savings';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';


interface Task {
    id: string;
    name: string;
    category: string;
    priority: Priority;
    dueDate: string;
    status: TaskStatus;
    subtasks: { id: string; text: string; completed: boolean }[];
    linkedExpenseId?: string | null;
    recurring: Recurrence;
    color?: string;
    icon?: string;
}

interface Expense {
    id: string;
    date: string;
    type: TransactionType;
    category: string;
    amount: number;
    description: string;
    paymentMethod: PaymentMethod;
    wallet: Wallet;
    linkedTaskId?: string | null;
}

// --- MOCK DATA ---
const createInitialDate = (dayOffset: number) => new Date(new Date().setDate(new Date().getDate() + dayOffset)).toISOString().split('T')[0];

const initialTasks: Task[] = [
    { id: 't1', name: 'Pay Electricity Bill', category: 'Bills', priority: 'High', dueDate: createInitialDate(0), status: 'Pending', subtasks: [], linkedExpenseId: 'e1', recurring: 'monthly', icon: 'home' },
    { id: 't2', name: 'Grocery Shopping', category: 'Home', priority: 'Medium', dueDate: createInitialDate(2), status: 'Pending', subtasks: [], recurring: 'weekly', icon: 'cart' },
    { id: 't3', name: 'Team Meeting', category: 'Work', priority: 'High', dueDate: createInitialDate(1), status: 'Pending', subtasks: [], recurring: 'none', icon: 'briefcase', color: '#3b82f6' },
    { id: 't4', name: 'Renew Gym Membership', category: 'Health', priority: 'Low', dueDate: createInitialDate(10), status: 'Pending', subtasks: [], recurring: 'monthly', icon: 'heart' },
    { id: 't5', name: 'Book Flight Tickets', category: 'Travel', priority: 'High', dueDate: createInitialDate(-1), status: 'Completed', subtasks: [], recurring: 'none', icon: 'plane' },
    { id: 't6', name: 'Submit Project Report', category: 'Work', priority: 'High', dueDate: createInitialDate(-2), status: 'Pending', subtasks: [], recurring: 'none', icon: 'briefcase' },
];

const initialExpenses: Expense[] = [
    { id: 'e1', date: createInitialDate(-1), type: 'Expense', category: 'Bills', amount: 1500, description: 'Electricity Bill', paymentMethod: 'UPI', wallet: 'Personal', linkedTaskId: 't1' },
    { id: 'e2', date: createInitialDate(-3), type: 'Income', category: 'Salary', amount: 50000, description: 'Monthly Salary', paymentMethod: 'Bank Transfer', wallet: 'Personal' },
    { id: 'e3', date: createInitialDate(-5), type: 'Expense', category: 'Food', amount: 500, description: 'Pizza Night', paymentMethod: 'Card', wallet: 'Personal' },
    { id: 'e4', date: createInitialDate(-7), type: 'Expense', category: 'Shopping', amount: 2500, description: 'New Clothes', paymentMethod: 'Card', wallet: 'Personal' },
    { id: 'e5', date: createInitialDate(-10), type: 'Income', category: 'Business', amount: 10000, description: 'Freelance Project', paymentMethod: 'Bank Transfer', wallet: 'Business' },
];

// --- SVG ICONS ---
const icons = {
    dashboard: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
    ),
    tasks: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    cashbook: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    ),
    settings: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.332.183-.582.495-.645.87l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.87l.213-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    plus: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    trash: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
    ),
    edit: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
    ),
    ai: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.25 21.75l-.648-1.178a2.625 2.625 0 00-1.94-1.94l-1.178-.648 1.178-.648a2.625 2.625 0 001.94-1.94l.648-1.178.648 1.178a2.625 2.625 0 001.94 1.94l1.178.648-1.178.648a2.625 2.625 0 00-1.94 1.94z" />
        </svg>
    ),
    sun: (props: React.SVGProps<SVGSVGElement>) => (
         <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.95-4.243l-1.59-1.591M5.25 12H3m4.243-4.95l-1.59-1.591M12 12a4.5 4.5 0 014.5 4.5v.008c0 .351-.023.693-.067 1.028a4.5 4.5 0 11-8.866 0c-.044-.335-.067-.677-.067-1.028V16.5A4.5 4.5 0 0112 12z" />
        </svg>
    ),
    moon: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
    ),
    chevronLeft: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
    ),
    chevronRight: (props: React.SVGProps<SVGSVGElement>) => (
         <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
    ),
    link: (props: React.SVGProps<SVGSVGElement>) => (
         <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
    ),
    repeat: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l3.181-3.183a8.25 8.25 0 00-11.664 0l3.181 3.183" />
        </svg>
    ),
     checkCircle: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
    ),
    xCircle: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
    ),
    arrowUp: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.99 9.17a.75.75 0 01-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L10.75 5.612V16.25a.75.75 0 01-.75-.75z" clipRule="evenodd" />
        </svg>
    ),
    arrowDown: (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.26-3.56a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.99 12.44a.75.75 0 111.06-1.06l3.26 3.56V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
        </svg>
    ),
};

const taskIcons: { [key: string]: React.FC<React.SVGProps<SVGSVGElement>> } = {
    briefcase: (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.05a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.25a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v.75M15.75 18H18a2.25 2.25 0 002.25-2.25V6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 12.75H6.75a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25v-4.5a2.25 2.25 0 00-2.25-2.25z" />
        </svg>
    ),
    cart: (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l1.823-6.44a1.125 1.125 0 00-1.087-1.462H5.25l-.321-1.206a1.125 1.125 0 00-1.087-1.462H3.75" />
        </svg>
    ),
    heart: (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
    ),
    gift: (props) => (
         <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.375v6.375h6.375V3.375h-6.375zm0 17.25h6.375v-6.375h-6.375v6.375zM3.375 10.125h6.375v-6.375H3.375v6.375zM3.375 20.625v-6.375h6.375v6.375H3.375z" />
        </svg>
    ),
    plane: (props) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L6 12z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9" />
        </svg>
    ),
    home: (props) => (
         <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
    )
};

const taskColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];


// --- UTILITY HOOKS & FUNCTIONS ---
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
};

const getPriorityColor = (priority: Priority, theme: Theme) => {
    const colors = {
        High: theme === 'light' ? 'var(--color-light-danger)' : 'var(--color-dark-danger)',
        Medium: theme === 'light' ? 'var(--color-light-warning)' : 'var(--color-dark-warning)',
        Low: theme === 'light' ? 'var(--color-light-success)' : 'var(--color-dark-success)',
    };
    return colors[priority];
};

const getCategoryColor = (category: string) => {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6',
        '#d946ef', '#ec4899'
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [view, setView] = useLocalStorage<View>('view', 'Dashboard');
    const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', initialTasks);
    const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', initialExpenses);
    
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    
    const handleSaveTask = (taskToSave: Task) => {
        setTasks(prev => {
            const existing = prev.find(t => t.id === taskToSave.id);
            if (existing) {
                // If the link changed, update the corresponding expense
                if (existing.linkedExpenseId !== taskToSave.linkedExpenseId) {
                    if (existing.linkedExpenseId) {
                        setExpenses(ePrev => ePrev.map(e => e.id === existing.linkedExpenseId ? { ...e, linkedTaskId: null } : e));
                    }
                    if (taskToSave.linkedExpenseId) {
                         setExpenses(ePrev => ePrev.map(e => e.id === taskToSave.linkedExpenseId ? { ...e, linkedTaskId: taskToSave.id } : e));
                    }
                }
                return prev.map(t => t.id === taskToSave.id ? taskToSave : t);
            }
            // If it's a new task with a link
            if (taskToSave.linkedExpenseId) {
                setExpenses(ePrev => ePrev.map(e => e.id === taskToSave.linkedExpenseId ? { ...e, linkedTaskId: taskToSave.id } : e));
            }
            return [...prev, taskToSave];
        });
    };

    const handleDeleteTask = (taskId: string) => {
        const taskToDelete = tasks.find(t => t.id === taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        // Unlink from expense if linked
        if (taskToDelete?.linkedExpenseId) {
            setExpenses(prev => prev.map(e => e.id === taskToDelete.linkedExpenseId ? { ...e, linkedTaskId: null } : e));
        }
    };
    
    const handleToggleTaskStatus = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (task.recurring !== 'none' && task.status === 'Pending') { // Only generate next if completing
             const getNextDueDate = (dateStr: string, recurrence: Recurrence) => {
                const date = new Date(dateStr);
                 date.setUTCHours(0, 0, 0, 0); // Normalize date
                if (recurrence === 'daily') date.setDate(date.getDate() + 1);
                if (recurrence === 'weekly') date.setDate(date.getDate() + 7);
                if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1);
                return date.toISOString().split('T')[0];
            };
            
            // Create the next occurrence
            const nextTask: Task = {
                ...task,
                id: `t-${Date.now()}`,
                dueDate: getNextDueDate(task.dueDate, task.recurring),
                status: 'Pending',
                linkedExpenseId: null, // New task isn't linked
            };
            
            // Mark current as complete and non-recurring
            const completedTask: Task = {...task, status: 'Completed', recurring: 'none'};
            
            setTasks(prev => [...prev.map(t => t.id === taskId ? completedTask : t), nextTask]);

        } else {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: t.status === 'Pending' ? 'Completed' : 'Pending' } : t));
        }
    };

    const handleSaveTransaction = (transaction: Expense) => {
         setExpenses(prev => {
            const existing = prev.find(e => e.id === transaction.id);
            if (existing) {
                 // If the link changed, update the corresponding task
                if (existing.linkedTaskId !== transaction.linkedTaskId) {
                    if (existing.linkedTaskId) {
                        setTasks(tPrev => tPrev.map(t => t.id === existing.linkedTaskId ? { ...t, linkedExpenseId: null } : t));
                    }
                    if (transaction.linkedTaskId) {
                         setTasks(tPrev => tPrev.map(t => t.id === transaction.linkedTaskId ? { ...t, linkedExpenseId: transaction.id } : t));
                    }
                }
                return prev.map(e => e.id === transaction.id ? transaction : e);
            }
            // If it's a new expense with a link
            if (transaction.linkedTaskId) {
                setTasks(tPrev => tPrev.map(t => t.id === transaction.linkedTaskId ? { ...t, linkedExpenseId: transaction.id } : t));
            }
            return [...prev, transaction];
        });
    };

    const handleDeleteTransaction = (expenseId: string) => {
        const expenseToDelete = expenses.find(e => e.id === expenseId);
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
        // Unlink from task if linked
        if (expenseToDelete?.linkedTaskId) {
            // FIX: Corrected a typo where 'e' was used instead of 't', causing a reference error.
            setTasks(prev => prev.map(t => t.id === expenseToDelete.linkedTaskId ? { ...t, linkedExpenseId: null } : t));
        }
    };

    const renderView = () => {
        switch (view) {
            case 'Dashboard':
                return <Dashboard tasks={tasks} expenses={expenses} setView={setView} />;
            case 'Tasks':
                return <TasksPage tasks={tasks} expenses={expenses} onSave={handleSaveTask} onDelete={handleDeleteTask} onToggleStatus={handleToggleTaskStatus} theme={theme} />;
            case 'Cash Book':
                return <CashBookPage expenses={expenses} tasks={tasks} onSave={handleSaveTransaction} onDelete={handleDeleteTransaction} theme={theme} />;
            case 'Settings':
                return <SettingsPage theme={theme} setTheme={setTheme} />;
            default:
                return <Dashboard tasks={tasks} expenses={expenses} setView={setView} />;
        }
    };
    
    return (
        <>
            <main className="app-main">
                {renderView()}
            </main>
            <AppMenu activeView={view} setView={setView} />
            <style>{STYLES}</style>
        </>
    );
};

// --- NAVIGATION ---
const AppMenu: React.FC<{ activeView: View; setView: (view: View) => void }> = ({ activeView, setView }) => {
    const menuItems: { view: View; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
        { view: 'Dashboard', label: 'Dashboard', icon: icons.dashboard },
        { view: 'Tasks', label: 'Tasks', icon: icons.tasks },
        { view: 'Cash Book', label: 'Cash Book', icon: icons.cashbook },
        { view: 'Settings', label: 'Settings', icon: icons.settings },
    ];
    
    return (
        <nav className="app-menu">
            {menuItems.map(({ view, label, icon: Icon }) => (
                <button
                    key={view}
                    className={`menu-item ${activeView === view ? 'active' : ''}`}
                    onClick={() => setView(view)}
                    aria-label={label}
                >
                    <Icon className="menu-icon" />
                    <span className="menu-label">{label}</span>
                </button>
            ))}
        </nav>
    );
};

// --- PAGES ---
const Dashboard: React.FC<{ tasks: Task[], expenses: Expense[], setView: (view: View) => void }> = ({ tasks, expenses, setView }) => {
    const summary = useMemo(() => {
        const totalIncome = expenses.filter(e => e.type === 'Income').reduce((sum, e) => sum + e.amount, 0);
        const totalExpense = expenses.filter(e => e.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);
        const balance = totalIncome - totalExpense;
        const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
        const overdueTasks = tasks.filter(t => t.status === 'Pending' && new Date(t.dueDate) < new Date(new Date().toDateString())).length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        return { totalIncome, totalExpense, balance, pendingTasks, overdueTasks, completedTasks };
    }, [tasks, expenses]);
    
    const taskChartData = [
        { name: 'Pending', value: summary.pendingTasks, color: 'var(--warning-color)' },
        { name: 'Completed', value: summary.completedTasks, color: 'var(--success-color)' },
        { name: 'Overdue', value: summary.overdueTasks, color: 'var(--danger-color)' },
    ].filter(d => d.value > 0);

    const expenseChartData = useMemo(() => {
        const expenseByCategory = expenses
            .filter(e => e.type === 'Expense')
            .reduce((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(expenseByCategory).map(([name, value]) => ({
            name,
            value,
            color: getCategoryColor(name),
        })).sort((a,b) => b.value - a.value);
    }, [expenses]);
    
    const recentTransactions = [...expenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);

    return (
        <div className="page-container">
            <header className="page-header">
                <h1>Dashboard</h1>
            </header>
            <div className="dashboard-grid">
                <div className="dashboard-card balance-card">
                    <p className="card-label">Total Balance</p>
                    <h2 className="balance-amount">₹{summary.balance.toLocaleString('en-IN')}</h2>
                    <div className="balance-details">
                        <div className="balance-income">
                           <icons.arrowUp className="balance-icon income" />
                           <div>
                                <p>Income</p>
                                <span>₹{summary.totalIncome.toLocaleString('en-IN')}</span>
                           </div>
                        </div>
                        <div className="balance-expense">
                            <icons.arrowDown className="balance-icon expense" />
                            <div>
                                <p>Expense</p>
                                <span>₹{summary.totalExpense.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="dashboard-card tasks-summary-card">
                     <p className="card-label">Task Overview</p>
                     <div className="task-summary-items">
                        <div>
                            <span>{summary.pendingTasks}</span>
                            <p>Pending</p>
                        </div>
                        <div>
                            <span>{summary.overdueTasks}</span>
                            <p>Overdue</p>
                        </div>
                        <div>
                            <span>{summary.completedTasks}</span>
                            <p>Completed</p>
                        </div>
                     </div>
                     <button className="card-cta-button" onClick={() => setView('Tasks')}>Manage Tasks</button>
                </div>

                <div className="dashboard-card chart-card">
                     <p className="card-label">Task Status</p>
                     <PieChart data={taskChartData} />
                </div>
                
                <div className="dashboard-card chart-card">
                     <p className="card-label">Expense Breakdown</p>
                     <PieChart data={expenseChartData} />
                </div>
                
                 <div className="dashboard-card recent-transactions-card">
                    <p className="card-label">Recent Transactions</p>
                    <div className="transaction-list-mini">
                        {recentTransactions.length > 0 ? recentTransactions.map(t => (
                             <div key={t.id} className="transaction-item-mini">
                                 <div className={`transaction-icon-mini ${t.type.toLowerCase()}`}>
                                    {t.type === 'Income' ? <icons.arrowUp /> : <icons.arrowDown />}
                                 </div>
                                 <div className="transaction-details-mini">
                                     <p>{t.description}</p>
                                     <small>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {t.category}</small>
                                 </div>
                                 <p className={`transaction-amount-mini ${t.type.toLowerCase()}`}>
                                    {t.type === 'Income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                                 </p>
                             </div>
                        )) : <p className="empty-state-mini">No recent transactions.</p>}
                    </div>
                     <button className="card-cta-button" onClick={() => setView('Cash Book')}>View All</button>
                </div>

            </div>
        </div>
    );
};

const TasksPage: React.FC<{
    tasks: Task[];
    expenses: Expense[];
    onSave: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string) => void;
    theme: Theme;
}> = ({ tasks, expenses, onSave, onDelete, onToggleStatus, theme }) => {
    const [viewMode, setViewMode] = useState<'List' | 'Calendar'>('List');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('All');
    
    const categories = ['All', ...Array.from(new Set(tasks.map(t => t.category).filter(Boolean)))];
    
    const filteredTasks = tasks.filter(task => filterCategory === 'All' || task.category === filterCategory);

    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setSelectedTask(null);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedTask(null);
    };
    
    const [aiSummary, setAiSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const getAiSummary = async () => {
        setIsLoading(true);
        setAiSummary('');
        try {
            const prompt = `Provide a concise, friendly summary of these tasks. Mention the number of overdue, pending, and completed tasks. Highlight the most critical upcoming task. Tasks: ${JSON.stringify(tasks.map(t => ({ name: t.name, status: t.status, dueDate: t.dueDate, priority: t.priority })))}`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAiSummary(response.text);
        } catch (error) {
            console.error(error);
            setAiSummary('Sorry, I couldn\'t generate a summary right now.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container">
            <header className="page-header with-toggle">
                <h1>Tasks</h1>
                <div className="view-toggle">
                    <button className={viewMode === 'List' ? 'active' : ''} onClick={() => setViewMode('List')}>List</button>
                    <button className={viewMode === 'Calendar' ? 'active' : ''} onClick={() => setViewMode('Calendar')}>Calendar</button>
                </div>
            </header>
            
            {viewMode === 'List' && (
                <>
                    <div className="page-actions">
                         <div className="category-filters">
                             {categories.map(cat => (
                                 <button key={cat} className={filterCategory === cat ? 'active' : ''} onClick={() => setFilterCategory(cat)}>
                                     {cat}
                                 </button>
                             ))}
                         </div>
                         <button className="ai-button" onClick={getAiSummary} disabled={isLoading}>
                           <icons.ai className="icon" />
                           {isLoading ? 'Generating...' : 'Get AI Summary'}
                        </button>
                    </div>

                    {aiSummary && <p className="ai-summary">{aiSummary}</p>}
                    
                    <TaskList tasks={filteredTasks} onEdit={handleEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} theme={theme} />
                </>
            )}

            {viewMode === 'Calendar' && <TasksCalendar tasks={tasks} onTaskClick={handleEdit} theme={theme} />}

            <button className="fab" onClick={handleAddNew}>
                <icons.plus />
            </button>

            {isModalOpen && <TaskModal task={selectedTask} expenses={expenses} onSave={onSave} onClose={handleCloseModal} />}
        </div>
    );
};

const TaskList: React.FC<{
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string) => void;
    theme: Theme;
}> = ({ tasks, onEdit, onDelete, onToggleStatus, theme }) => {
    if (tasks.length === 0) return <p className="empty-state">No tasks yet. Add one to get started!</p>;

    const sortedTasks = [...tasks].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).sort((a,b) => (a.status === 'Completed' ? 1 : -1));

    return (
        <div className="task-list">
            {sortedTasks.map(task => (
                <div key={task.id} className={`task-item ${task.status.toLowerCase()}`}>
                    <div className="task-indicator" style={{ backgroundColor: task.color || getPriorityColor(task.priority, theme) }}></div>
                    <button className="task-status-button" onClick={() => onToggleStatus(task.id)}>
                        <div className={`checkbox ${task.status === 'Completed' ? 'checked' : ''}`}>
                            {task.status === 'Completed' && <icons.checkCircle />}
                        </div>
                    </button>
                     <div className="task-icon">
                        {task.icon && taskIcons[task.icon] ? React.createElement(taskIcons[task.icon]) : null}
                    </div>
                    <div className="task-details">
                        <p className="task-name">{task.name}</p>
                        <div className="task-meta">
                           {task.category && <span className="task-category">{task.category}</span>}
                           <span className="task-due-date">{new Date(task.dueDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                           {/* FIX: Replaced unsupported `title` prop with a `<title>` child element for SVG accessibility. */}
                           {task.recurring !== 'none' && <icons.repeat className="recurring-icon"><title>{`Repeats ${task.recurring}`}</title></icons.repeat>}
                           {/* FIX: Replaced unsupported `title` prop with a `<title>` child element for SVG accessibility. */}
                           {task.linkedExpenseId && <icons.link className="linked-icon"><title>Linked to an expense</title></icons.link>}
                        </div>
                    </div>
                    <div className="task-priority" style={{ backgroundColor: getPriorityColor(task.priority, 'light') + '33', color: getPriorityColor(task.priority, 'light') }}>{task.priority}</div>
                    <div className="task-actions">
                        <button onClick={() => onEdit(task)}><icons.edit className="icon" /></button>
                        <button onClick={() => onDelete(task.id)}><icons.trash className="icon" /></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const TasksCalendar: React.FC<{ tasks: Task[], onTaskClick: (task: Task) => void, theme: Theme }> = ({ tasks, onTaskClick, theme }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
        setSelectedDay(null); // Deselect day when changing month
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // Correctly get the first day of the week (0 for Sunday)
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ key: `empty-${i}`, day: null, tasks: [] });
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.dueDate === dateStr).sort((a,b) => {
                const priorities = { 'High': 1, 'Medium': 2, 'Low': 3 };
                return priorities[a.priority] - priorities[b.priority];
            });
            days.push({ key: dateStr, day, tasks: dayTasks });
        }
        
        return days;
    }, [currentDate, tasks]);

    const weekDays = useMemo(() => {
        const short = ["S", "M", "T", "W", "T", "F", "S"];
        const long = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        // A simple heuristic for responsiveness
        return window.innerWidth < 768 ? short : long;
    }, []);

    const selectedDayTasks = tasks.filter(t => t.dueDate === selectedDay);

    return (
        <div className="calendar-wrapper">
            <div className="calendar-container">
                <div className="calendar-header">
                    <button onClick={() => changeMonth(-1)}><icons.chevronLeft className="icon" /></button>
                    <h2>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)}><icons.chevronRight className="icon" /></button>
                </div>
                <div className="calendar-grid">
                    {weekDays.map((day, i) => <div key={`${day}-${i}`} className="calendar-weekday">{day}</div>)}
                    {calendarGrid.map(({ key, day, tasks: dayTasks }) => {
                         const dateStr = key.startsWith('empty') ? '' : key;
                         const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                         return (
                            <div 
                                key={key} 
                                className={`calendar-day ${isToday ? 'today' : ''} ${selectedDay === dateStr ? 'selected' : ''}`}
                                onClick={() => day && setSelectedDay(dateStr)}
                            >
                               {day && <span className="day-number">{day}</span>}
                               <div className="calendar-tasks">
                                    {dayTasks.slice(0, 2).map(task => (
                                        <div 
                                            key={task.id} 
                                            className="calendar-task-pill"
                                            onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                            style={{ '--priority-color': task.color || getPriorityColor(task.priority, theme) } as React.CSSProperties}
                                        >
                                            {task.icon && taskIcons[task.icon] && React.createElement(taskIcons[task.icon], {className: 'pill-icon'})}
                                            <span className="pill-text">{task.name}</span>
                                        </div>
                                    ))}
                                    {dayTasks.length > 2 && <div className="more-tasks-indicator">+{dayTasks.length - 2} more</div>}
                               </div>
                            </div>
                         );
                    })}
                </div>
            </div>
            {selectedDay && (
                <div className="selected-day-tasks">
                    <h3>Tasks for {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    {selectedDayTasks.length > 0 ? (
                        <TaskList tasks={selectedDayTasks} onEdit={onTaskClick} onDelete={() => {}} onToggleStatus={() => {}} theme={theme} />
                    ) : (
                        <p className="empty-state">No tasks for this day.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const TaskModal: React.FC<{ task: Task | null, expenses: Expense[], onSave: (task: Task) => void, onClose: () => void }> = ({ task, expenses, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: task?.name || '',
        category: task?.category || '',
        priority: task?.priority || 'Medium',
        dueDate: task?.dueDate || new Date().toISOString().split('T')[0],
        linkedExpenseId: task?.linkedExpenseId || '',
        recurring: task?.recurring || 'none',
        color: task?.color || '',
        icon: task?.icon || '',
    });
    
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomChange = (name: 'color' | 'icon', value: string) => {
        setFormData(prev => ({ ...prev, [name]: prev[name] === value ? '' : value })); // Toggle on/off
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const taskToSave: Task = {
            id: task?.id || `t-${Date.now()}`,
            name: formData.name,
            category: formData.category,
            priority: formData.priority,
            dueDate: formData.dueDate,
            linkedExpenseId: formData.linkedExpenseId || null,
            recurring: formData.recurring,
            color: formData.color || undefined,
            icon: formData.icon || undefined,
            status: task?.status || 'Pending',
            subtasks: task?.subtasks || [],
        };
        onSave(taskToSave);
        onClose();
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content" ref={modalRef}>
                <h2>{task ? 'Edit Task' : 'Add New Task'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Task Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Category</label>
                        <input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="e.g., Work, Home" />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Priority</label>
                            <select name="priority" value={formData.priority} onChange={handleChange}>
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Due Date</label>
                            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Icon</label>
                        <div className="icon-picker">
                            {Object.keys(taskIcons).map(iconKey => (
                                <button type="button" key={iconKey} className={`icon-picker-item ${formData.icon === iconKey ? 'selected' : ''}`} onClick={() => handleCustomChange('icon', iconKey)}>
                                    {React.createElement(taskIcons[iconKey])}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Color</label>
                        <div className="color-picker">
                            {taskColors.map(color => (
                                <button type="button" key={color} className={`color-picker-item ${formData.color === color ? 'selected' : ''}`} style={{ backgroundColor: color }} onClick={() => handleCustomChange('color', color)} />
                            ))}
                        </div>
                    </div>
                     <div className="form-row">
                        <div className="form-group">
                            <label>Recurring</label>
                            <select name="recurring" value={formData.recurring} onChange={handleChange}>
                                <option value="none">None</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Link to Expense</label>
                            <select name="linkedExpenseId" value={formData.linkedExpenseId || ''} onChange={handleChange}>
                                <option value="">None</option>
                                {expenses.map(e => (
                                    <option key={e.id} value={e.id}>{e.description} (-₹{e.amount})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button-primary">{task ? 'Save Changes' : 'Add Task'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CashBookPage: React.FC<{ 
    expenses: Expense[], 
    tasks: Task[],
    onSave: (expense: Expense) => void, 
    onDelete: (id: string) => void,
    theme: Theme;
}> = ({ expenses, tasks, onSave, onDelete, theme }) => {
    const [viewMode, setViewMode] = useState<'Transactions' | 'Reports'>('Transactions');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [filters, setFilters] = useState({ type: 'All', category: 'All', wallet: 'All' });

    const handleEdit = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setSelectedExpense(null);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedExpense(null);
    };
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value}));
    };
    
    const filteredExpenses = expenses.filter(e => 
        (filters.type === 'All' || e.type === filters.type) &&
        (filters.category === 'All' || e.category === filters.category) &&
        (filters.wallet === 'All' || e.wallet === filters.wallet)
    );
    
    const categories = ['All', ...Array.from(new Set(expenses.map(e => e.category)))];
    const wallets = ['All', ...Array.from(new Set(expenses.map(e => e.wallet)))];
    
    const [aiSummary, setAiSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const getAiSummary = async () => {
        setIsLoading(true);
        setAiSummary('');
        try {
            const prompt = `Provide a concise, friendly summary of these financial transactions. Mention total income, total expenses, and the net balance. Highlight the largest expense category. Transactions: ${JSON.stringify(expenses.map(e => ({ type: e.type, amount: e.amount, category: e.category })))}`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAiSummary(response.text);
        } catch (error) {
            console.error(error);
            setAiSummary('Sorry, I couldn\'t generate a summary right now.');
        } finally {
            setIsLoading(false);
        }
    };


    return (
         <div className="page-container">
            <header className="page-header with-toggle">
                <h1>Cash Book</h1>
                <div className="view-toggle">
                    <button className={viewMode === 'Transactions' ? 'active' : ''} onClick={() => setViewMode('Transactions')}>Transactions</button>
                    <button className={viewMode === 'Reports' ? 'active' : ''} onClick={() => setViewMode('Reports')}>Reports</button>
                </div>
            </header>
            
            {viewMode === 'Transactions' && (
                <>
                    <div className="page-actions-grid">
                         <select name="type" value={filters.type} onChange={handleFilterChange}>
                            <option value="All">All Types</option>
                            <option value="Income">Income</option>
                            <option value="Expense">Expense</option>
                         </select>
                         <select name="category" value={filters.category} onChange={handleFilterChange}>
                             {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                         </select>
                         <select name="wallet" value={filters.wallet} onChange={handleFilterChange}>
                             {wallets.map(w => <option key={w} value={w}>{w === 'All' ? 'All Wallets' : w}</option>)}
                         </select>
                         <button className="ai-button" onClick={getAiSummary} disabled={isLoading}>
                           <icons.ai className="icon" />
                           {isLoading ? '...' : 'AI Summary'}
                        </button>
                    </div>

                    {aiSummary && <p className="ai-summary">{aiSummary}</p>}
                    <TransactionList expenses={filteredExpenses} onEdit={handleEdit} onDelete={onDelete} />
                </>
            )}

            {viewMode === 'Reports' && <ReportsPage expenses={expenses} theme={theme} />}

            <button className="fab" onClick={handleAddNew}>
                <icons.plus />
            </button>

            {isModalOpen && <ExpenseModal expense={selectedExpense} tasks={tasks} onSave={onSave} onClose={handleCloseModal} />}
        </div>
    );
};

const TransactionList: React.FC<{ expenses: Expense[], onEdit: (expense: Expense) => void, onDelete: (id: string) => void }> = ({ expenses, onEdit, onDelete }) => {
    if (expenses.length === 0) return <p className="empty-state">No transactions yet. Add one to get started!</p>;
    
    const sortedExpenses = [...expenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="transaction-list">
            {sortedExpenses.map(expense => (
                <div key={expense.id} className="transaction-item">
                    <div className={`transaction-indicator ${expense.type.toLowerCase()}`}></div>
                    <div className="transaction-details">
                         <p className="transaction-description">{expense.description}</p>
                         <div className="transaction-meta">
                             <span>{new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span> •
                             <span>{expense.category}</span> •
                             <span>{expense.wallet}</span>
                             {/* FIX: Replaced unsupported `title` prop with a `<title>` child element for SVG accessibility. */}
                             {expense.linkedTaskId && <icons.link className="linked-icon"><title>Linked to a task</title></icons.link>}
                         </div>
                    </div>
                    <p className={`transaction-amount ${expense.type.toLowerCase()}`}>
                         {expense.type === 'Income' ? '+' : '-'}₹{expense.amount.toLocaleString('en-IN')}
                    </p>
                    <div className="transaction-actions">
                        <button onClick={() => onEdit(expense)}><icons.edit className="icon" /></button>
                        <button onClick={() => onDelete(expense.id)}><icons.trash className="icon" /></button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ExpenseModal: React.FC<{ expense: Expense | null, tasks: Task[], onSave: (expense: Expense) => void, onClose: () => void }> = ({ expense, tasks, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<Expense, 'id'>>({
        date: expense?.date || new Date().toISOString().split('T')[0],
        type: expense?.type || 'Expense',
        category: expense?.category || '',
        amount: expense?.amount || 0,
        description: expense?.description || '',
        paymentMethod: expense?.paymentMethod || 'Cash',
        wallet: expense?.wallet || 'Personal',
        linkedTaskId: expense?.linkedTaskId || null,
    });
    
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const expenseToSave: Expense = {
            id: expense?.id || `e-${Date.now()}`,
            ...formData,
        };
        onSave(expenseToSave);
        onClose();
    };

    return (
         <div className="modal-backdrop">
            <div className="modal-content" ref={modalRef}>
                <h2>{expense ? 'Edit Transaction' : 'Add New Transaction'}</h2>
                <form onSubmit={handleSubmit}>
                     <div className="form-group">
                        <label>Description</label>
                        <input type="text" name="description" value={formData.description} onChange={handleChange} required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount</label>
                            <input type="number" name="amount" value={formData.amount} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Type</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
                                <option>Expense</option>
                                <option>Income</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Category</label>
                            <input type="text" name="category" value={formData.category} onChange={handleChange} required placeholder="e.g., Food, Salary" />
                        </div>
                    </div>

                     <div className="form-row">
                        <div className="form-group">
                            <label>Payment Method</label>
                            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                                <option>Cash</option>
                                <option>Card</option>
                                <option>UPI</option>
                                <option>Bank Transfer</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Wallet</label>
                            <select name="wallet" value={formData.wallet} onChange={handleChange}>
                                <option>Personal</option>
                                <option>Business</option>
                                <option>Savings</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Link to Task</label>
                        <select name="linkedTaskId" value={formData.linkedTaskId || ''} onChange={handleChange}>
                             <option value="">None</option>
                             {tasks.filter(t => t.status === 'Pending').map(t => (
                                 <option key={t.id} value={t.id}>{t.name}</option>
                             ))}
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button-primary">{expense ? 'Save Changes' : 'Add Transaction'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ReportsPage: React.FC<{ expenses: Expense[], theme: Theme }> = ({ expenses, theme }) => {
    
    const expenseChartData = useMemo(() => {
        const expenseByCategory = expenses
            .filter(e => e.type === 'Expense')
            .reduce((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(expenseByCategory).map(([name, value]) => ({
            name,
            value,
            color: getCategoryColor(name),
        })).sort((a,b) => b.value - a.value);
    }, [expenses]);
    
    type TimeFilter = 'This Week' | 'This Month' | 'Last 6 Months' | 'This Year';
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('Last 6 Months');


    return (
        <div className="reports-container">
            <div className="report-card">
                 <h3>Expense Breakdown</h3>
                 <PieChart data={expenseChartData} />
            </div>
            <div className="report-card">
                 <div className="chart-header">
                    <h3>Financial Trends</h3>
                     <div className="chart-filters">
                         {(['This Week', 'This Month', 'Last 6 Months', 'This Year'] as TimeFilter[]).map(filter => (
                              <button key={filter} className={timeFilter === filter ? 'active' : ''} onClick={() => setTimeFilter(filter)}>
                                  {filter}
                              </button>
                         ))}
                     </div>
                 </div>
                 <TrendChart expenses={expenses} timeFilter={timeFilter} theme={theme}/>
            </div>
        </div>
    );
};

const SettingsPage: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void }> = ({ theme, setTheme }) => {
    return (
        <div className="page-container">
            <header className="page-header">
                <h1>Settings</h1>
            </header>
            <div className="settings-content">
                <div className="setting-item">
                    <p>Theme</p>
                    <div className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                        <div className={`theme-toggle-slider ${theme}`}>
                            {theme === 'light' ? <icons.sun /> : <icons.moon />}
                        </div>
                    </div>
                </div>
                 <div className="setting-item">
                    <p>Currency</p>
                    <p className="setting-value">INR (₹)</p>
                </div>
                 <div className="setting-item">
                    <p>Subscription</p>
                    <p className="setting-value">Free Plan</p>
                </div>
                 <button className="button-primary">Upgrade to Premium</button>
            </div>
        </div>
    );
};

// --- CHART COMPONENTS ---
const PieChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
    if (data.length === 0) {
        return <p className="empty-state-mini">No data to display.</p>
    }
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;

    return (
         <div className="pie-chart-container">
            <svg viewBox="0 0 36 36" className="pie-chart">
                {data.map((item, index) => {
                    const percentage = (item.value / total) * 100;
                    const dashArray = `${percentage} ${100 - percentage}`;
                    const dashOffset = 25 - cumulative;
                    cumulative += percentage;
                    return (
                        <circle
                            key={index}
                            cx="18" cy="18" r="15.9155"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="3.8"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                        />
                    );
                })}
            </svg>
            <div className="pie-chart-legend">
                {data.slice(0, 5).map((item) => (
                    <div key={item.name} className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: item.color }}></span>
                        <span className="legend-label">{item.name}</span>
                        <span className="legend-value">{((item.value / total) * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TrendChart: React.FC<{expenses: Expense[], timeFilter: 'This Week' | 'This Month' | 'Last 6 Months' | 'This Year', theme: Theme}> = ({ expenses, timeFilter, theme }) => {
    const chartData = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        let labels: string[] = [];
        let groupBy: 'day' | 'week' | 'month' = 'month';

        switch (timeFilter) {
            case 'This Week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                labels = Array.from({length: 7}, (_, i) => {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    return d.toLocaleDateString('en-US', { weekday: 'short' });
                });
                groupBy = 'day';
                break;
            case 'This Month':
                 startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                 const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                 labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
                 groupBy = 'day';
                 break;
            case 'Last 6 Months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                labels = Array.from({length: 6}, (_, i) => {
                    const d = new Date(startDate);
                    d.setMonth(d.getMonth() + i);
                    return d.toLocaleDateString('en-US', { month: 'short' });
                });
                groupBy = 'month';
                break;
            case 'This Year':
                startDate = new Date(now.getFullYear(), 0, 1);
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                groupBy = 'month';
                break;
        }

        const filtered = expenses.filter(e => new Date(e.date) >= startDate);
        
        const data = labels.map(() => ({ income: 0, expense: 0 }));

        filtered.forEach(e => {
            const date = new Date(e.date);
            let index = -1;
            if (groupBy === 'day') {
                if (timeFilter === 'This Week') {
                    index = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                } else { // This Month
                    index = date.getDate() - 1;
                }
            } else if (groupBy === 'month') {
                 if (timeFilter === 'Last 6 Months') {
                     index = (date.getFullYear() - startDate.getFullYear()) * 12 + date.getMonth() - startDate.getMonth();
                 } else { // This Year
                     index = date.getMonth();
                 }
            }
            
            if (index >= 0 && index < data.length) {
                if (e.type === 'Income') data[index].income += e.amount;
                else data[index].expense += e.amount;
            }
        });

        return { labels, datasets: data };
    }, [expenses, timeFilter]);
    
    const maxAmount = Math.max(...chartData.datasets.flatMap(d => [d.income, d.expense]), 1);

    const [tooltip, setTooltip] = useState<{ x: number, y: number, label: string, income: number, expense: number } | null>(null);

    const handleMouseOver = (e: React.MouseEvent<SVGRectElement>, index: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: rect.x + rect.width / 2,
            y: rect.y,
            label: chartData.labels[index],
            income: chartData.datasets[index].income,
            expense: chartData.datasets[index].expense
        });
    };
    
    const svgPath = (data: number[]) => {
        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - (value / maxAmount) * 100;
            return `${x},${y}`;
        }).join(' L ');
        return `M ${points}`;
    };


    return (
        <div className="trend-chart-container">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-chart-svg">
                <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success-color)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--success-color)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--danger-color)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--danger-color)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines */}
                {Array.from({length: 5}).map((_, i) => (
                    <line key={i} x1="0" y1={i * 25} x2="100" y2={i * 25} stroke="var(--border-color)" strokeWidth="0.1" strokeDasharray="2" />
                ))}

                {/* Expense Area */}
                <path d={svgPath(chartData.datasets.map(d => d.expense)) + ` L 100,100 L 0,100 Z`} fill="url(#expenseGradient)" />
                <path d={svgPath(chartData.datasets.map(d => d.expense))} fill="none" stroke="var(--danger-color)" strokeWidth="0.5" />
                
                 {/* Income Area */}
                <path d={svgPath(chartData.datasets.map(d => d.income)) + ` L 100,100 L 0,100 Z`} fill="url(#incomeGradient)" />
                <path d={svgPath(chartData.datasets.map(d => d.income))} fill="none" stroke="var(--success-color)" strokeWidth="0.5" />
                
                {/* Interaction layer */}
                <g onMouseLeave={() => setTooltip(null)}>
                    {chartData.datasets.map((_, index) => (
                        <rect 
                            key={index}
                            x={(index / (chartData.labels.length - 1)) * 100 - 1}
                            y="0"
                            width="2"
                            height="100"
                            fill="transparent"
                            onMouseOver={(e) => handleMouseOver(e, index)}
                        />
                    ))}
                </g>
            </svg>
            <div className="chart-labels">
                {chartData.labels.map((label, i) => <span key={i}>{label}</span>)}
            </div>
            {tooltip && ReactDOM.createPortal(
                 <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
                    <strong>{tooltip.label}</strong>
                    <div><span className="legend-color" style={{backgroundColor: 'var(--success-color)'}}></span>Income: ₹{tooltip.income.toLocaleString('en-IN')}</div>
                    <div><span className="legend-color" style={{backgroundColor: 'var(--danger-color)'}}></span>Expense: ₹{tooltip.expense.toLocaleString('en-IN')}</div>
                 </div>,
                document.body
            )}
        </div>
    );
};


// --- STYLES ---
const STYLES = `
    /* --- Base & Layout --- */
    .app-main {
        flex-grow: 1;
        overflow-y: auto;
        padding: 1.5rem 1.5rem 6rem 1.5rem; /* Padding at bottom for FAB and nav */
    }

    .page-container {
        max-width: 1200px;
        margin: 0 auto;
        animation: fadeIn 0.5s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        font-size: 2rem;
        font-weight: 800;
        color: var(--text-primary);
    }
    
    .page-header.with-toggle {
        margin-bottom: 1rem;
    }
    
    /* --- Floating Action Button --- */
    .fab {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background-color: var(--accent-color);
        color: var(--accent-text-color);
        border: none;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 4px 12px var(--shadow-color);
        cursor: pointer;
        transition: transform 0.2s ease-out;
        z-index: 100;
    }

    .fab:hover {
        transform: scale(1.05);
    }

    .fab svg {
        width: 28px;
        height: 28px;
    }
    
    /* --- Main Navigation Menu --- */
    .app-menu {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 65px;
        background-color: var(--surface-color);
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 1000;
        box-shadow: 0 -2px 10px var(--shadow-color);
    }

    .menu-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--text-secondary);
        font-family: var(--font-main);
        font-size: 0.75rem;
        padding: 0.5rem;
        cursor: pointer;
        transition: color 0.2s, transform 0.2s;
        border-radius: 8px;
        width: 70px;
    }

    .menu-item:hover {
        color: var(--accent-color);
    }
    
    .menu-item.active {
        color: var(--accent-color);
        font-weight: 600;
    }

    .menu-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 4px;
    }

    /* --- Common Elements --- */
    .empty-state {
        text-align: center;
        margin-top: 4rem;
        color: var(--text-secondary);
    }
    
    .empty-state-mini {
        font-size: 0.9rem;
        color: var(--text-secondary);
        text-align: center;
        padding: 1rem 0;
    }

    .view-toggle {
        display: flex;
        background-color: var(--bg-color);
        border-radius: 99px;
        padding: 4px;
        border: 1px solid var(--border-color);
    }

    .view-toggle button {
        background: none;
        border: none;
        padding: 8px 16px;
        border-radius: 99px;
        cursor: pointer;
        font-weight: 500;
        color: var(--text-secondary);
        transition: all 0.2s ease;
    }

    .view-toggle button.active {
        background-color: var(--accent-color);
        color: var(--accent-text-color);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .ai-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background-color: var(--accent-color);
        color: var(--accent-text-color);
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .ai-button:hover {
        opacity: 0.9;
    }
    .ai-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .ai-button .icon {
        width: 18px;
        height: 18px;
    }
    .ai-summary {
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-left: 4px solid var(--accent-color);
        padding: 1rem;
        margin-bottom: 1.5rem;
        border-radius: 8px;
        color: var(--text-secondary);
        line-height: 1.6;
    }
    
    /* --- Dashboard --- */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .dashboard-card {
        background-color: var(--surface-color);
        padding: 1.5rem;
        border-radius: 16px;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px var(--shadow-color);
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .dashboard-card.recent-transactions-card {
        grid-column: span 1 / span 1;
    }

    @media (min-width: 900px) {
      .dashboard-card.chart-card {
         grid-column: span 1;
      }
      .dashboard-card.balance-card, .dashboard-card.tasks-summary-card {
         grid-column: span 1;
      }
      .dashboard-card.recent-transactions-card {
        grid-column: span 2 / span 2;
      }
    }
    
    @media (min-width: 1200px) {
        .dashboard-grid {
             grid-template-columns: repeat(4, 1fr);
        }
        .dashboard-card.balance-card { grid-column: span 2; }
        .dashboard-card.tasks-summary-card { grid-column: span 2; }
        .dashboard-card.chart-card { grid-column: span 1; }
        .dashboard-card.recent-transactions-card { grid-column: span 2; }
    }
    
    .card-label {
        font-weight: 600;
        color: var(--text-secondary);
    }
    
    .balance-card .balance-amount {
        font-size: 2.5rem;
        font-weight: 800;
    }

    .balance-details {
        display: flex;
        gap: 1.5rem;
        margin-top: auto;
    }

    .balance-income, .balance-expense {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .balance-icon {
        width: 24px;
        height: 24px;
        padding: 4px;
        border-radius: 50%;
    }
    .balance-icon.income {
        color: var(--success-color);
        background-color: var(--success-color-trans);
    }
    .balance-icon.expense {
        color: var(--danger-color);
        background-color: var(--danger-color-trans);
    }
    .balance-details p {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    .balance-details span {
        font-weight: 600;
        font-size: 1rem;
    }

    .tasks-summary-card .task-summary-items {
        display: flex;
        justify-content: space-around;
        text-align: center;
        flex-grow: 1;
        align-items: center;
    }

    .task-summary-items span {
        font-size: 2rem;
        font-weight: 700;
    }
    .task-summary-items p {
        color: var(--text-secondary);
        font-weight: 500;
    }
    
    .card-cta-button {
        background: var(--accent-color);
        color: var(--accent-text-color);
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        margin-top: auto;
        transition: opacity 0.2s;
    }
    .card-cta-button:hover { opacity: 0.9; }

    /* --- Recent Transactions Mini List --- */
    .transaction-list-mini {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex-grow: 1;
    }
    .transaction-item-mini {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .transaction-icon-mini {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .transaction-icon-mini.income { background-color: #10b98120; color: #10b981; }
    .transaction-icon-mini.expense { background-color: #ef444420; color: #ef4444; }
    .transaction-icon-mini svg { width: 18px; height: 18px; }

    .transaction-details-mini {
        flex-grow: 1;
    }
    .transaction-details-mini p { font-weight: 600; }
    .transaction-details-mini small { color: var(--text-secondary); }
    .transaction-amount-mini { font-weight: 700; }
    .transaction-amount-mini.income { color: var(--success-color); }
    .transaction-amount-mini.expense { color: var(--danger-color); }

    /* --- Task Page --- */
    .page-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .category-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .category-filters button {
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        padding: 8px 16px;
        border-radius: 99px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
    }
    .category-filters button:hover {
        background-color: var(--bg-color);
        border-color: var(--accent-color);
    }
    .category-filters button.active {
        background-color: var(--accent-color);
        color: var(--accent-text-color);
        border-color: var(--accent-color);
    }
    
    .task-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .task-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background-color: var(--surface-color);
        padding: 1rem;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: 0 2px 4px var(--shadow-color);
        transition: box-shadow 0.2s;
        position: relative;
        overflow: hidden;
    }
    .task-item:hover {
        box-shadow: 0 4px 8px var(--shadow-color);
    }
    .task-item.completed {
        opacity: 0.6;
    }
    .task-item.completed .task-name {
        text-decoration: line-through;
    }

    .task-indicator {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 5px;
    }

    .task-status-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        z-index: 1;
    }

    .checkbox {
        width: 24px;
        height: 24px;
        border: 2px solid var(--border-color);
        border-radius: 50%;
        transition: all 0.2s;
    }
    .checkbox.checked {
        border-color: var(--success-color);
        background-color: var(--success-color);
        color: var(--surface-color);
    }
    .checkbox svg {
        width: 100%;
        height: 100%;
    }
    
    .task-icon {
        color: var(--text-secondary);
    }
    .task-icon svg {
        width: 20px;
        height: 20px;
    }

    .task-details {
        flex-grow: 1;
    }

    .task-name {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    .task-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    .task-category {
        background-color: var(--bg-color);
        padding: 2px 8px;
        border-radius: 99px;
    }
    .recurring-icon, .linked-icon {
        width: 14px;
        height: 14px;
    }

    .task-priority {
        padding: 4px 12px;
        border-radius: 99px;
        font-weight: 600;
        font-size: 0.8rem;
        margin-left: auto;
    }
    .task-actions {
        display: flex;
        gap: 0.5rem;
    }
    .task-actions button {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        transition: color 0.2s;
    }
    .task-actions button:hover {
        color: var(--accent-color);
    }
    .task-actions .icon {
        width: 20px;
        height: 20px;
    }

    /* --- Calendar --- */
    .calendar-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    .calendar-container {
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        overflow: hidden;
        animation: fadeIn 0.5s ease-out;
        box-shadow: 0 4px 12px var(--shadow-color);
    }
    
    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding: 0 0.5rem;
    }
    .calendar-header h2 { font-size: 1.25rem; }
    .calendar-header button {
        background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 8px; border-radius: 50%;
    }
    .calendar-header button:hover { color: var(--accent-color); background-color: var(--bg-color); }
    .calendar-header .icon { width: 24px; height: 24px; }
    
    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        animation: fadeIn 0.3s ease-out;
    }
    .calendar-weekday {
        text-align: center;
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 0.8rem;
        padding-bottom: 0.5rem;
    }
    .calendar-day {
        position: relative;
        min-height: 100px;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 8px;
        transition: background-color 0.2s, border-color 0.2s;
        cursor: pointer;
    }
    .calendar-day:hover {
        background-color: var(--bg-color);
    }
    .calendar-day.selected {
        background-color: var(--accent-color-trans);
        border-color: var(--accent-color);
    }
    .day-number {
        font-weight: 600;
        font-size: 0.9rem;
    }
    .calendar-day.today .day-number {
        color: var(--accent-text-color);
        background-color: var(--accent-color);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .calendar-tasks {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .calendar-task-pill {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        padding: 4px 6px;
        border-radius: 6px;
        background-color: color-mix(in srgb, var(--priority-color) 20%, transparent);
        border-left: 3px solid var(--priority-color);
        color: var(--text-primary);
        font-weight: 500;
        cursor: pointer;
        overflow: hidden;
        transition: background-color 0.2s;
    }
    .calendar-task-pill:hover {
        background-color: color-mix(in srgb, var(--priority-color) 30%, transparent);
    }
    .pill-icon {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
    }
    .pill-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .more-tasks-indicator {
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--text-secondary);
        margin-top: 4px;
        text-align: center;
    }
    .selected-day-tasks {
        background-color: var(--surface-color);
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid var(--border-color);
        animation: fadeIn 0.5s;
    }
    .selected-day-tasks h3 { margin-bottom: 1rem; }
    
    @media (max-width: 768px) {
        .app-main { padding: 1rem 1rem 6rem 1rem; }
        .page-header h1 { font-size: 1.75rem; }
        .dashboard-grid, .task-list, .transaction-list { gap: 1rem; }
        .dashboard-card { padding: 1rem; }
        
        .calendar-container { padding: 1rem; }
        .calendar-day { min-height: 80px; padding: 4px; }
        .day-number { font-size: 0.8rem; }
        .calendar-task-pill { font-size: 0.65rem; padding: 2px 4px; border-left-width: 2px;}
    }

    /* --- Cash Book Page --- */
    .page-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .page-actions-grid select, .page-actions-grid .ai-button {
        width: 100%;
    }
    
    .transaction-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .transaction-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background-color: var(--surface-color);
        padding: 1rem;
        border-radius: 12px;
        border: 1px solid var(--border-color);
    }
    .transaction-indicator {
        width: 5px;
        height: 40px;
        border-radius: 99px;
    }
    .transaction-indicator.income { background-color: var(--success-color); }
    .transaction-indicator.expense { background-color: var(--danger-color); }

    .transaction-details { flex-grow: 1; }
    .transaction-description { font-weight: 600; }
    .transaction-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    .transaction-amount {
        font-weight: 700;
        font-size: 1.1rem;
        margin-left: auto;
    }
    .transaction-amount.income { color: var(--success-color); }
    .transaction-amount.expense { color: var(--danger-color); }
    .transaction-actions { display: flex; gap: 0.5rem; margin-left: 1rem; }
    .transaction-actions button { background:none; border:none; color: var(--text-secondary); cursor: pointer; padding: 4px;}
    .transaction-actions button:hover { color: var(--accent-color); }
    .transaction-actions .icon { width: 20px; height: 20px; }
    
    /* --- Reports Page --- */
    .reports-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
    }
    .report-card {
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 12px var(--shadow-color);
    }
    .report-card h3 {
        margin-bottom: 1.5rem;
        font-weight: 700;
    }
    
    .chart-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .chart-header h3 { margin: 0; }
    .chart-filters {
        display: flex;
        background-color: var(--bg-color);
        border-radius: 8px;
        padding: 4px;
    }
    .chart-filters button {
        background: none; border: none; padding: 6px 12px;
        border-radius: 6px; cursor: pointer; font-size: 0.8rem;
        font-weight: 500; color: var(--text-secondary);
    }
    .chart-filters button.active {
        background-color: var(--surface-color);
        color: var(--text-primary);
        box-shadow: 0 1px 3px var(--shadow-color);
    }
    
    /* --- Pie Chart --- */
    .pie-chart-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
    .pie-chart {
        width: 150px;
        height: 150px;
        transform: rotate(-90deg);
        border-radius: 50%;
    }
    .pie-chart-legend {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
    }
    .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }
    .legend-label {
        flex-grow: 1;
        color: var(--text-secondary);
    }
    .legend-value {
        font-weight: 600;
    }
    
    @media (min-width: 500px) {
      .pie-chart-container {
        flex-direction: row;
        align-items: center;
      }
      .pie-chart-legend {
        width: auto;
        flex-grow: 1;
      }
    }
    
    /* --- Trend Chart --- */
    .trend-chart-container {
        position: relative;
        height: 300px;
    }
    .trend-chart-svg {
        width: 100%;
        height: calc(100% - 20px);
    }
    .chart-labels {
        height: 20px;
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--text-secondary);
        padding: 0 5px;
    }
    .chart-tooltip {
        position: fixed;
        transform: translate(-50%, -110%);
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 0.75rem;
        box-shadow: 0 4px 12px var(--shadow-color);
        pointer-events: none;
        z-index: 9999;
        font-size: 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        white-space: nowrap;
    }
    .chart-tooltip strong {
        font-weight: 600;
    }
    .chart-tooltip div { display: flex; align-items: center; gap: 6px; }


    /* --- Settings Page --- */
    .settings-content {
        max-width: 600px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 12px;
    }
    .setting-item p {
        font-weight: 600;
    }
    .setting-value {
        color: var(--text-secondary);
    }
    .theme-toggle {
        width: 50px;
        height: 28px;
        background-color: var(--bg-color);
        border-radius: 99px;
        padding: 4px;
        cursor: pointer;
    }
    .theme-toggle-slider {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: var(--surface-color);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
    }
    .theme-toggle-slider.dark {
        transform: translateX(22px);
    }
    .theme-toggle-slider svg {
        width: 14px;
        height: 14px;
    }

    /* --- Modal --- */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        animation: fadeIn 0.3s;
    }
    .modal-content {
        background-color: var(--surface-color);
        padding: 2rem;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px var(--shadow-color);
    }
    .modal-content h2 {
        margin-bottom: 1.5rem;
    }
    .form-group {
        margin-bottom: 1.25rem;
    }
    .form-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }
    .form-group input, .form-group select {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background-color: var(--bg-color);
        color: var(--text-primary);
        font-family: var(--font-main);
        font-size: 1rem;
    }
    .form-row {
        display: flex;
        gap: 1rem;
    }
    .form-row .form-group {
        flex: 1;
    }
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-top: 2rem;
    }
    .button-primary, .button-secondary {
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
    }
    .button-primary {
        background-color: var(--accent-color);
        color: var(--accent-text-color);
    }
    .button-secondary {
        background-color: var(--bg-color);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
    }
    
    /* --- Color & Icon Pickers --- */
    .color-picker, .icon-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .color-picker-item {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.2s, border-color 0.2s;
    }
    .color-picker-item:hover {
        transform: scale(1.1);
    }
    .color-picker-item.selected {
        border-color: var(--accent-color);
    }
    
    .icon-picker-item {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 2px solid var(--border-color);
        background-color: var(--bg-color);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }
    .icon-picker-item:hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
    }
    .icon-picker-item.selected {
        border-color: var(--accent-color);
        background-color: var(--accent-color-trans);
        color: var(--accent-color);
    }
    .icon-picker-item svg {
        width: 20px;
        height: 20px;
    }

`;

// FIX: Use `createRoot` from `react-dom/client` instead of `ReactDOM.createRoot`.
createRoot(document.getElementById('root')!).render(<App />);
