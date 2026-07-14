import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag } from "antd";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { createUser, deleteUser, listUsers, updateUser, type AuthUser } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";
import { useUserStore } from "@/stores/use-user-store";

export default function AdminUsersPage() {
    const { message, modal } = App.useApp();
    const currentUser = useUserStore((state) => state.user);
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [form] = Form.useForm();

    if (currentUser?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    const refresh = async () => {
        setLoading(true);
        try {
            const result = await listUsers();
            setUsers(result.users);
        } catch (error) {
            message.error(error instanceof ApiError ? error.message : "加载用户失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const handleCreate = async () => {
        const values = await form.validateFields();
        try {
            await createUser({
                username: values.username.trim(),
                password: values.password,
                displayName: values.displayName?.trim() || values.username.trim(),
                role: values.role || "user",
            });
            message.success("用户已创建");
            setOpen(false);
            form.resetFields();
            await refresh();
        } catch (error) {
            message.error(error instanceof ApiError ? error.message : "创建失败");
        }
    };

    const toggleDisabled = async (user: AuthUser, disabled: boolean) => {
        try {
            await updateUser(user.id, { disabled });
            message.success(disabled ? "已禁用" : "已启用");
            await refresh();
        } catch (error) {
            message.error(error instanceof ApiError ? error.message : "更新失败");
        }
    };

    const resetPassword = (user: AuthUser) => {
        let password = "";
        let confirmPassword = "";
        modal.confirm({
            title: `重置密码：${user.username}`,
            content: (
                <div className="space-y-3 pt-1">
                    <Input.Password
                        placeholder="新密码至少 6 位"
                        onChange={(event) => {
                            password = event.target.value;
                        }}
                    />
                    <Input.Password
                        placeholder="请再输入一遍新密码"
                        onChange={(event) => {
                            confirmPassword = event.target.value;
                        }}
                    />
                </div>
            ),
            okText: "重置",
            onOk: async () => {
                if (!password || password.length < 6) {
                    message.warning("密码至少 6 位");
                    return Promise.reject();
                }
                if (password !== confirmPassword) {
                    message.warning("两次输入的密码不一致");
                    return Promise.reject();
                }
                await updateUser(user.id, { password });
                message.success("密码已重置");
            },
        });
    };

    const removeUser = (user: AuthUser) => {
        modal.confirm({
            title: "删除用户",
            content: `确认删除 ${user.username}？其画布和素材会删除，共享提示词会保留。`,
            okText: "删除",
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await deleteUser(user.id);
                    message.success("已删除");
                    await refresh();
                } catch (error) {
                    message.error(error instanceof ApiError ? error.message : "删除失败");
                }
            },
        });
    };

    return (
        <main className="app-page h-full overflow-y-auto">
            <div className="app-page-shell max-w-5xl">
                <div className="app-page-header flex items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-medium tracking-wide text-stone-500 dark:text-stone-400">管理员</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">用户管理</h1>
                        <p className="mt-2 text-sm text-stone-500">仅管理员可创建账号。普通用户登录后使用统一 API 配置。</p>
                    </div>
                    <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
                        新建用户
                    </Button>
                </div>

                <div className="app-surface overflow-hidden rounded-2xl p-1.5 sm:p-2">
                    <Table
                        rowKey="id"
                        loading={loading}
                        dataSource={users}
                        pagination={false}
                        columns={[
                            { title: "用户名", dataIndex: "username" },
                            { title: "显示名", dataIndex: "displayName" },
                            {
                                title: "角色",
                                dataIndex: "role",
                                render: (role: AuthUser["role"]) => <Tag color={role === "admin" ? "blue" : "default"}>{role === "admin" ? "管理员" : "用户"}</Tag>,
                            },
                            {
                                title: "状态",
                                dataIndex: "disabled",
                                render: (disabled: boolean, record) => <Switch checked={!disabled} checkedChildren="启用" unCheckedChildren="禁用" onChange={(checked) => void toggleDisabled(record, !checked)} />,
                            },
                            {
                                title: "操作",
                                render: (_, record) => (
                                    <Space>
                                        <Button size="small" onClick={() => resetPassword(record)}>
                                            重置密码
                                        </Button>
                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={record.id === currentUser?.id} onClick={() => removeUser(record)} />
                                    </Space>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

            <Modal title="新建用户" open={open} onCancel={() => setOpen(false)} onOk={() => void handleCreate()} okText="创建">
                <Form form={form} layout="vertical" requiredMark={false} initialValues={{ role: "user" }}>
                    <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="displayName" label="显示名">
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: "至少 6 位" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="role" label="角色">
                        <Select options={[{ label: "普通用户", value: "user" }, { label: "管理员", value: "admin" }]} />
                    </Form.Item>
                </Form>
            </Modal>
        </main>
    );
}
