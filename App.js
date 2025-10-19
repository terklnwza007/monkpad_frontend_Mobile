// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";  // ✅ เพิ่มบรรทัดนี้

import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import Tabs from "./src/navigation/Tabs";
import AddTransactionScreen from "./src/screens/AddTransactionScreen";
import EditTransactionScreen from "./src/screens/EditTransactionScreen";
import SummaryScreen from "./src/screens/SummaryScreen";
import SettingScreen from "./src/screens/SettingScreen";


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#0E1116" },
            headerTintColor: "#ffffffff",
            headerTitleStyle: { fontWeight: "bold" },
            contentStyle: { backgroundColor: "#e1e2e4ff" },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false ,title: "หน้าหลัก"}} />
          <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ title: "เพิ่มรายการ" }} />
          <Stack.Screen name="EditTransaction" component={EditTransactionScreen} options={{ title: "แก้ไขรายการ" }} />
          <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: "สรุปผลรายการ" }} />
          <Stack.Screen name="Setting" component={SettingScreen} options={{ headerShown: false }}  />


        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
