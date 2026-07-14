import { App, Button, Form, Input } from "antd";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, PanelsTopLeft, UserRound } from "lucide-react";

import { ApiError } from "@/services/api/client";
import { useUserStore } from "@/stores/use-user-store";

type LoginValues = {
    username: string;
    password: string;
};

export default function LoginPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const status = useUserStore((state) => state.status);
    const user = useUserStore((state) => state.user);
    const login = useUserStore((state) => state.login);
    const [submitting, setSubmitting] = useState(false);

    if (status === "authenticated" && user) {
        return <Navigate to="/canvas" replace />;
    }

    const onFinish = async (values: LoginValues) => {
        setSubmitting(true);
        try {
            await login(values.username.trim(), values.password);
            message.success("登录成功");
            navigate("/canvas", { replace: true });
        } catch (error) {
            message.error(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "登录失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative flex min-h-dvh overflow-y-auto bg-stone-100 p-3 text-stone-950 dark:bg-stone-950 dark:text-stone-50 sm:p-5">
            <main className="relative min-h-[calc(100dvh-1.5rem)] w-full overflow-hidden rounded-[1.75rem] border border-stone-200 bg-stone-50 shadow-[0_24px_80px_rgba(28,25,23,0.12)] dark:border-stone-800 dark:bg-stone-900 sm:min-h-[calc(100dvh-2.5rem)]">
                <div aria-hidden className="absolute inset-0 opacity-[0.12] dark:opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(120,113,108,.52) 1px, transparent 1px), linear-gradient(90deg, rgba(120,113,108,.52) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
                <header className="absolute left-7 top-7 z-20 flex items-center gap-3 text-sm font-semibold tracking-wide sm:left-10 sm:top-10">
                    <span className="grid size-10 place-items-center rounded-xl bg-stone-950 text-stone-50 shadow-[0_10px_30px_rgba(28,25,23,0.12)] dark:bg-stone-50 dark:text-stone-950 dark:shadow-[0_10px_30px_rgba(255,255,255,0.12)]">
                        <PanelsTopLeft className="size-5" />
                    </span>
                    无限画布
                </header>
                <svg aria-hidden viewBox="0 0 1440 900" preserveAspectRatio="none" className="absolute inset-0 hidden size-full xl:block">
                    <path d="M300 240H530C610 240 620 360 720 360" fill="none" stroke="currentColor" strokeWidth="1" className="text-stone-300 dark:text-stone-700" />
                    <path d="M1110 650H910C830 650 820 540 720 540" fill="none" stroke="currentColor" strokeWidth="1" className="text-stone-300 dark:text-stone-700" />
                    <circle cx="720" cy="360" r="4" className="fill-stone-400 dark:fill-stone-600" />
                    <circle cx="720" cy="540" r="4" className="fill-stone-400 dark:fill-stone-600" />
                </svg>
                <div aria-hidden className="absolute left-[14%] top-[18%] hidden w-40 rotate-[-3deg] rounded-xl border border-stone-200 bg-stone-50 p-2 shadow-[0_14px_32px_rgba(41,37,36,0.07)] xl:block dark:border-stone-800 dark:bg-stone-900 dark:shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
                    <div className="h-24 rounded-lg bg-[linear-gradient(145deg,#d7cec1_0%,#f5f0e9_43%,#9e9184_44%,#635a51_100%)] dark:bg-[linear-gradient(145deg,#4a443d_0%,#27241f_43%,#766c60_44%,#3a352f_100%)]" />
                    <div className="mt-2 flex gap-1.5 px-1">
                        <span className="h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
                        <span className="h-1.5 w-5 rounded-full bg-stone-200 dark:bg-stone-800" />
                    </div>
                </div>
                <div aria-hidden className="absolute bottom-[17%] right-[13%] hidden w-48 rotate-[2deg] rounded-xl border border-stone-200 bg-stone-50 p-2 shadow-[0_14px_32px_rgba(41,37,36,0.07)] xl:block dark:border-stone-800 dark:bg-stone-900 dark:shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
                    <div className="grid h-24 grid-cols-[1.35fr_1fr] gap-2">
                        <div className="rounded-lg bg-[linear-gradient(150deg,#b8aa98_0%,#ded4c7_48%,#74685b_49%,#51483f_100%)] dark:bg-[linear-gradient(150deg,#5a5045_0%,#302b25_48%,#75695c_49%,#443b33_100%)]" />
                        <div className="rounded-lg bg-stone-200 dark:bg-stone-800" />
                    </div>
                    <div className="mt-2 flex gap-1.5 px-1">
                        <span className="h-1.5 flex-1 rounded-full bg-stone-300 dark:bg-stone-700" />
                        <span className="h-1.5 w-6 rounded-full bg-stone-200 dark:bg-stone-800" />
                    </div>
                </div>
                <div aria-hidden className="absolute bottom-[27%] left-[27%] hidden size-3 rounded-full border-[3px] border-stone-50 bg-stone-400 shadow-sm xl:block dark:border-stone-900 dark:bg-stone-600" />
                <div className="relative min-h-[calc(100dvh-1.5rem)] sm:min-h-[calc(100dvh-2.5rem)]">
                    <section className="absolute inset-0 z-10 flex items-center justify-center px-5 py-24 sm:px-10">
                        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-stone-50/90 p-6 shadow-[0_18px_45px_rgba(41,37,36,0.08)] backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/90 dark:shadow-[0_18px_45px_rgba(0,0,0,0.2)] sm:p-7">
                            <h2 className="mb-8 text-3xl font-semibold tracking-[-0.045em]">欢迎登录</h2>
                            <Form layout="vertical" requiredMark={false} size="large" onFinish={(values) => void onFinish(values)}>
                                <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]} className="mb-5">
                                    <Input autoFocus autoComplete="username" placeholder="输入用户名" prefix={<UserRound className="size-4 text-stone-400" />} className="!h-12 !rounded-xl !bg-stone-100/70 dark:!bg-stone-950" />
                                </Form.Item>
                                <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]} className="mb-7">
                                    <Input.Password autoComplete="current-password" placeholder="输入密码" prefix={<LockKeyhole className="size-4 text-stone-400" />} className="!h-12 !rounded-xl !bg-stone-100/70 dark:!bg-stone-950" />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block loading={submitting} className="!h-12 !rounded-xl !text-sm !font-semibold">
                                    进入画布
                                </Button>
                            </Form>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
