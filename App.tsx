// import React from 'react';
// // import { StatusBar } from 'react-native';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// // import { AppNavigator } from './src/navigation/AppNavigator';
// // import { Colors } from './src/theme';
//
// export default function App() {
//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       {/*<StatusBar*/}
//       {/*  barStyle="dark-content"*/}
//       {/*  backgroundColor={Colors.bgPage}*/}
//       {/*  translucent={false}*/}
//       {/*/>*/}
//       {/*<AppNavigator />*/}
//     </GestureHandlerRootView>
//   );
// }

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

const HelloWorldApp = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Hello, world!</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
    },
});

export default HelloWorldApp;
