package com.cocos.game.tap;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Proxy;
import java.lang.reflect.InvocationHandler;

/**
 * 极简反射工具。
 *
 * 为什么用反射而不是直接 import TapSDK / Dirichlet:
 *   这两个 SDK 的 AAR 体积大、版本多,而且不同版本的方法签名并不完全一致
 *   (例如防沉迷 init 就有 init(activity, config) + setAntiAddictionCallback(cb)
 *    和 init(activity, config, cb) 两种写法)。
 *   如果写死 import,一旦仓库里没有 AAR 工程就编译不过,换版本还要改代码。
 *   这里按"运行时按签名找方法"的方式调用:
 *     - AAR 缺失 -> 找不到类 -> 明确返回 false,JS 侧降级并打告警,不影响游戏启动;
 *     - AAR 版本不同 -> 按参数类型匹配到对应重载,不需要改代码;
 *     - 方法真的对不上 -> 日志打印 "缺少方法 xxx",一眼能定位。
 *
 * 代价:没有编译期检查。所以每次升级 SDK 后,必须真机跑一遍并看日志有无 "缺少" 字样。
 */
public final class TapReflect {

    private TapReflect() {
    }

    /** 按候选全限定名依次尝试加载,全部失败返回 null */
    public static Class<?> findClass(String... fqns) {
        for (String fqn : fqns) {
            try {
                return Class.forName(fqn);
            } catch (Throwable ignored) {
                // 继续尝试下一个
            }
        }
        return null;
    }

    /** 调用静态方法 */
    public static Object callStatic(Class<?> cls, String name, Object... args) throws Exception {
        Method m = match(cls, name, args, true);
        if (m == null) {
            throw new NoSuchMethodException(cls.getSimpleName() + "." + name + "/" + args.length);
        }
        return m.invoke(null, args);
    }

    /** 调用实例方法 */
    public static Object call(Object target, String name, Object... args) throws Exception {
        if (target == null) {
            throw new IllegalArgumentException("target is null when calling " + name);
        }
        Method m = match(target.getClass(), name, args, false);
        if (m == null) {
            throw new NoSuchMethodException(target.getClass().getSimpleName() + "." + name + "/" + args.length);
        }
        return m.invoke(target, args);
    }

    /** 实例方法是否存在(用于能力探测,例如 logout 在老版本里没有) */
    public static boolean hasMethod(Class<?> cls, String name, int paramCount) {
        for (Method m : cls.getMethods()) {
            if (m.getName().equals(name) && m.getParameterTypes().length == paramCount) {
                return true;
            }
        }
        return false;
    }

    private static Method match(Class<?> cls, String name, Object[] args, boolean staticOnly) {
        for (Method m : cls.getMethods()) {
            if (!m.getName().equals(name)) continue;
            if (staticOnly && !Modifier.isStatic(m.getModifiers())) continue;
            Class<?>[] ps = m.getParameterTypes();
            if (ps.length != args.length) continue;
            boolean ok = true;
            for (int i = 0; i < ps.length; i++) {
                if (!assignable(ps[i], args[i])) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                // SDK 内部类可能不是 public,放行访问权限,避免 IllegalAccessException
                try {
                    m.setAccessible(true);
                } catch (Throwable ignored) {
                }
                return m;
            }
        }
        return null;
    }

    private static boolean assignable(Class<?> param, Object arg) {
        if (arg == null) return !param.isPrimitive();
        if (param.isInstance(arg)) return true;
        if (!param.isPrimitive()) return false;
        if (param == int.class) return arg instanceof Integer;
        if (param == boolean.class) return arg instanceof Boolean;
        if (param == long.class) return arg instanceof Long;
        if (param == float.class) return arg instanceof Float;
        if (param == double.class) return arg instanceof Double;
        if (param == short.class) return arg instanceof Short;
        if (param == byte.class) return arg instanceof Byte;
        return false;
    }

    /** 生成接口的动态代理(用于把 SDK 的 Listener / Callback 接口转成我们自己的处理器) */
    public static Object proxy(Class<?> iface, InvocationHandler handler) {
        return Proxy.newProxyInstance(iface.getClassLoader(), new Class[]{iface}, handler);
    }

    /** 找某个方法第 index 个参数的类型 */
    public static Class<?> paramType(Method m, int index) {
        Class<?>[] ps = m.getParameterTypes();
        return index < ps.length ? ps[index] : null;
    }

    /** 取内部类(如 Config.Builder),找不到返回 null */
    public static Class<?> nestedClass(Class<?> outer, String simpleName) {
        for (Class<?> c : outer.getDeclaredClasses()) {
            if (c.getSimpleName().equals(simpleName)) return c;
        }
        return null;
    }
}
