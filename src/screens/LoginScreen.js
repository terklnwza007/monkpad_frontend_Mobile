// src/screens/LoginScreen.js
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image
} from "react-native";
import { loginRequest } from "../lib/api";
import { saveToken } from "../lib/auth";

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const onSubmit = async () => {
        if (!username || !password) {
            Alert.alert("ข้อผิดพลาด", "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
            return;
        }
        setLoading(true);
        try {
            const resp = await loginRequest(username.trim(), password);
            await saveToken(resp.access_token);
            //navigation.replace("Home");
            navigation.replace("Tabs", { screen: "Home" }); // เข้าแท็บ Home (Transactions)

        } catch (e) {
            Alert.alert("เข้าสู่ระบบล้มเหลว", e?.message || "ไม่สามารถเข้าสู่ระบบได้");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.select({ ios: "padding", android: undefined })}
        >
            <View style={styles.card}>
                <View style={{ alignItems: "center", marginBottom: 10 }}>
  <Image
    source={require("../../assets/icon/logo.png")}
    style={{ width: 120, height: 120, marginBottom: 0 ,top:30}}
    resizeMode="contain"
  />
  <Text style={styles.brand}>Jod Monk</Text>
</View>
                <Text style={styles.subtitle}>เข้าสู่ระบบเพื่อใช้งาน</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>ชื่อผู้ใช้</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="username"
                        placeholderTextColor="#8B93A6"
                        returnKeyType="next"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>รหัสผ่าน</Text>
                    <View style={{ position: "relative" }}>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor="#8B93A6"
                            secureTextEntry={!showPassword}
                            returnKeyType="done"
                            onSubmitEditing={onSubmit}
                        />
                        <Pressable style={styles.eye} onPress={() => setShowPassword(s => !s)}>
                            <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
                        </Pressable>
                    </View>
                </View>

                <Pressable
                    style={[styles.button, loading && { opacity: 0.8 }]}
                    onPress={onSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator />
                    ) : (
                        <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
                    )}
                </Pressable>

        
                <Pressable onPress={() => navigation.replace("Signup")}>
                    <Text style={styles.helper}>
                        ยังไม่มีบัญชีใช่ไหมโยม? <Text style={[styles.helperLink, { color: "#22C55E" }]}>สมัครสมาชิก</Text>
                    </Text>
                </Pressable>


                

            </View>

            <Text style={styles.footer}>© {new Date().getFullYear()} JodMonk</Text>
        </KeyboardAvoidingView>
    );
}

const BG = "#0B1220";
const CARD = "#101827";
const BORDER = "#1E293B";
const TEXT = "#E5E7EB";
const MUTED = "#9CA3AF";
const ACCENT = "#3B82F6";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    card: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    brand: {
        fontSize: 35,
        fontWeight: "900",
        color: "#cec333d2",
        textAlign: "center",
        
    },
    subtitle: {
        color: MUTED,
        textAlign: "center",
        marginTop: 6,
        marginBottom: 18,
    },
    field: {
        marginBottom: 14,
    },
    label: {
        color: MUTED,
        marginBottom: 6,
    },
    input: {
        backgroundColor: "#0F172A",
        borderWidth: 1,
        borderColor: BORDER,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        color: TEXT,
    },
    eye: {
        position: "absolute",
        right: 10,
        top: 10,
        padding: 6,
    },
    eyeText: {
        color: MUTED,
        fontSize: 12,
    },
    button: {
        backgroundColor: ACCENT,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 6,
    },
    buttonText: {
        color: "white",
        fontWeight: "700",
        fontSize: 16,
    },
    helper: {
        color: MUTED,
        textAlign: "center",
        marginTop: 12,
    },
    helperLink: {
        color: ACCENT,
        fontWeight: "600",
    },
    footer: {
        textAlign: "center",
        color: MUTED,
        marginTop: 16,
    },
});
