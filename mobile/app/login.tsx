import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from './hooks/useAuth';
import { getApiBaseUrl } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

const LOCAL_ACCOUNTS_KEY = '@drivelegal_local_accounts';

// Simple local credential store (fallback when backend is offline)
async function localRegister(name: string, email: string, password: string) {
  const raw = await AsyncStorage.getItem(LOCAL_ACCOUNTS_KEY);
  const accounts: Record<string, any> = raw ? JSON.parse(raw) : {};
  const key = email.toLowerCase();
  if (accounts[key]) throw new Error('Email already registered locally.');
  accounts[key] = { name, email: key, password };
  await AsyncStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function localLogin(email: string, password: string) {
  const raw = await AsyncStorage.getItem(LOCAL_ACCOUNTS_KEY);
  const accounts: Record<string, any> = raw ? JSON.parse(raw) : {};
  const key = email.toLowerCase();
  const acc = accounts[key];
  if (!acc) throw new Error('No account found with this email.');
  if (acc.password !== password) throw new Error('Incorrect password.');
  return acc;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  // GOOGLE SIGN IN SETUP
  const redirectUri = AuthSession.makeRedirectUri({
    // scheme: 'your-app-scheme' // usually unnecessary for expo go / web
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '836187070362-ujggpiu8ubfdsc6diuji1cfnbiogqdnq.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID_HERE',
    iosClientId: 'YOUR_IOS_CLIENT_ID_HERE',
    redirectUri: redirectUri,
  });

  // Log the redirect URI to the console so we can see exactly what it is
  useEffect(() => {
    console.log('[Google Auth] The Redirect URI is:', redirectUri);
  }, [redirectUri]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLoginSuccess(authentication?.accessToken);
    } else if (response?.type === 'error') {
      setFormError(`Google Sign-In Error: ${response.error?.message || 'Unknown error'}`);
    }
  }, [response]);

  const handleGoogleLoginSuccess = async (accessToken?: string) => {
    if (!accessToken) return;
    setIsLoading(true);
    setFormError('');
    try {
      // 1. Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();
      
      if (!userInfo.email) {
        throw new Error('Failed to get email from Google.');
      }

      const baseUrl = getApiBaseUrl();

      // 2. Send email to backend /google endpoint
      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userInfo.email, 
          name: userInfo.name || userInfo.email.split('@')[0] 
        }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Google Login Failed on Server');
      
      const token = data.access_token;
      if (!token) throw new Error('Server returned no token.');
      
      // 3. Fetch user profile
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = await meRes.json().catch(() => ({}));
      if (!meRes.ok) throw new Error(userData.detail || 'Profile fetch failed');
      
      // 4. Log in locally
      await authLogin(token, userData);
      router.replace('/(tabs)');
      
    } catch (err: any) {
      console.error('[Google Login] Error:', err);
      setFormError(err.message || 'Google login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      const token = `demo_${Date.now()}`;
      const userData = {
        _id: 999999,
        name: 'User',
        email: 'demo@drivelegal.in',
        phone: '9876543210',
        vehicles: [],
        createdAt: new Date().toISOString(),
      };
      await authLogin(token, userData);
      router.replace('/(tabs)');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setFormError('');
    setPasswordError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const handleAuth = async () => {
    setFormError('');

    if (!email.trim()) { setFormError('Please enter your email.'); return; }
    if (!password) { setFormError('Please enter your password.'); return; }
    if (!isLogin && !name.trim()) { setFormError('Please enter your full name.'); return; }
    if (!isLogin && password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();

    try {
      let token: string | null = null;
      let userData: any = null;
      let useLocalFallback = false;

      const baseUrl = getApiBaseUrl();

      try {
        if (!isLogin) {
          // Register
          let regRes;
          try {
            regRes = await fetch(`${baseUrl}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name.trim(),
                email: trimmedEmail,
                password,
                phone: '0000000000',
                vehicles: [],
              }),
            });
          } catch (netErr) {
            useLocalFallback = true;
            throw new Error('NETWORK_ERROR');
          }
          const regData = await regRes.json().catch(() => ({}));
          if (!regRes.ok) throw new Error(regData.detail || regData.message || `Registration failed (${regRes.status})`);
        }

        if (!useLocalFallback) {
          // Login
          let loginRes;
          try {
            loginRes = await fetch(`${baseUrl}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: trimmedEmail, password }),
            });
          } catch (netErr) {
            useLocalFallback = true;
            throw new Error('NETWORK_ERROR');
          }
          const loginData = await loginRes.json().catch(() => ({}));
          if (!loginRes.ok) throw new Error(loginData.detail || loginData.message || `Login failed (${loginRes.status})`);

          token = loginData.access_token;
          if (!token) throw new Error('Server returned no token.');

          // Fetch user profile
          let meRes;
          try {
            meRes = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (netErr) {
            useLocalFallback = true;
            throw new Error('NETWORK_ERROR');
          }
          userData = await meRes.json().catch(() => ({}));
          if (!meRes.ok) throw new Error(userData.detail || 'Profile fetch failed');
        }
      } catch (backendErr: any) {
        if (backendErr.message !== 'NETWORK_ERROR') {
          // This is a legitimate backend error (e.g., 400 Email already registered)
          throw backendErr;
        }
      }

      if (useLocalFallback) {
        // ── Backend unreachable → fall back to local store ───
        console.warn('[Login] Backend unavailable, using local fallback');

        if (!isLogin) {
          await localRegister(name.trim(), trimmedEmail, password);
        }
        const localUser = await localLogin(trimmedEmail, password);

        // Build a mock token & user object for local session
        token = `local_${Date.now()}`;
        userData = {
          _id: trimmedEmail,
          name: localUser.name,
          email: localUser.email,
          phone: '',
          vehicles: [],
          createdAt: new Date().toISOString(),
        };
      }

      await authLogin(token!, userData);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Demo Login Button (Top Left) */}
      <TouchableOpacity 
        style={styles.demoButton} 
        onPress={handleDemoLogin}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Ionicons name="flash" size={14} color="#6b7280" />
        <Text style={styles.demoButtonText}>Demo Login</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>DL</Text>
            </View>
            <Text style={styles.logoText}>DriveLegal</Text>
          </View>

          {/* Heading */}
          <Text style={styles.title}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Log in to continue to DriveLegal'
              : 'Sign up to get started'}
          </Text>

          {/* Google Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => promptAsync()}
            disabled={!request || isLoading}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Inline error */}
          {!!formError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          )}

          {/* Name (sign-up only) */}
          {!isLogin && (
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={(t) => { setName(t); setFormError(''); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={(t) => { setEmail(t); setFormError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={(t) => { setPassword(t); setFormError(''); }}
              secureTextEntry
              returnKeyType={isLogin ? 'done' : 'next'}
              onSubmitEditing={isLogin ? handleAuth : undefined}
            />
          </View>

          {/* Confirm Password (sign-up only) */}
          {!isLogin && (
            <>
              <View style={[styles.inputWrapper, !!passwordError && styles.inputWrapperError]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordError ? '#dc2626' : '#9ca3af'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9ca3af"
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setPasswordError(''); }}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
              </View>
              {!!passwordError && (
                <Text style={styles.fieldError}>{passwordError}</Text>
              )}
            </>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleAuth}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Log In' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle login/signup */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account?  " : 'Already have an account?  '}
            </Text>
            <TouchableOpacity onPress={switchMode} activeOpacity={0.7}>
              <Text style={styles.toggleLink}>
                {isLogin ? 'Sign up' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF7F0' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#1B1A17',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoIconText: { color: '#C9621D', fontWeight: '700', fontSize: 15 },
  logoText: { fontSize: 22, fontWeight: '700', color: '#1B1A17', letterSpacing: -0.5 },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1A17',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  googleButtonText: { fontSize: 15, fontWeight: '500', color: '#374151' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 14, color: '#9ca3af', fontSize: 13 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: { flex: 1, color: '#dc2626', fontSize: 13 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputWrapperError: { borderColor: '#dc2626' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1f2937' },
  fieldError: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },

  primaryButton: {
    backgroundColor: '#C9621D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 22,
    minHeight: 52,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  toggleText: { color: '#6b7280', fontSize: 14 },
  toggleLink: { color: '#C9621D', fontSize: 14, fontWeight: '700' },

  demoButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  demoButtonText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
