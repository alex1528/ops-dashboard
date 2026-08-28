import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result } from 'antd';
import api from '../api';

/**
 * /oidc/callback — 接收后端 OIDC 流程回传的 JWT token，
 * 写入 localStorage 并跳转到管理后台。
 * 也处理后端重定向过来的错误信息。
 */
export default function OidcCallback() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否是错误回调
    const errorMsg = searchParams.get('error');
    if (errorMsg) {
      setError(errorMsg);
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError('未收到有效的认证令牌');
      return;
    }

    // Store token and fetch user info
    localStorage.setItem('token', token);

    api.get('/auth/me')
      .then(() => {
        // 成功后跳转，避免 axios 拦截器抢先 redirect
        window.location.href = '/admin';
      })
      .catch(() => {
        localStorage.removeItem('token');
        setError('令牌验证失败，请重新登录');
      });
  }, [searchParams, nav]);

  if (error) {
    return (
      <div className="login-page">
        <Result
          status="error"
          title="OIDC 登录失败"
          subTitle={error}
          extra={<a href="/login">返回登录页</a>}
        />
      </div>
    );
  }

  return (
    <div className="app-loading">
      <Spin size="large" tip="正在完成 OIDC 登录..." />
    </div>
  );
}
