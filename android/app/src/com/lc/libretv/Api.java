package com.lc.libretv;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;

final class Api {
    static final String DEFAULT_SERVER = "http://127.0.0.1:8080";
    static final String UA = "Mozilla/5.0 (Linux; Android 8.0; Skyworth TV) AppleWebKit/537.36 Chrome/96.0 Safari/537.36";
    final SharedPreferences prefs;
    volatile String cookie = "";
    Api(Context c) { prefs = c.getSharedPreferences("private_cinema", Context.MODE_PRIVATE); }
    String server() { return prefs.getString("server", DEFAULT_SERVER); }
    String companion() throws Exception {
        URL u=new URL(server());return new URL(u.getProtocol(),u.getHost(),8090,"").toString();
    }
    boolean discover() {
        String expected=prefs.getString("backendId","");
        try(DatagramSocket socket=new DatagramSocket()){
            socket.setBroadcast(true);socket.setSoTimeout(1800);
            byte[] message="PRIVATE_CINEMA_DISCOVER_V2".getBytes("UTF-8");
            socket.send(new DatagramPacket(message,message.length,InetAddress.getByName("255.255.255.255"),45831));
            long end=System.currentTimeMillis()+2000;
            while(System.currentTimeMillis()<end){
                byte[] bytes=new byte[2048];DatagramPacket response=new DatagramPacket(bytes,bytes.length);socket.receive(response);
                JSONObject j=new JSONObject(new String(response.getData(),0,response.getLength(),"UTF-8"));
                if(!"private-cinema-tv".equals(j.optString("service")))continue;
                if(!expected.isEmpty()&&!expected.equals(j.optString("backendId")))continue;
                String next="http://"+response.getAddress().getHostAddress()+":"+j.optInt("port",8080);
                prefs.edit().putString("server",next).putString("backendId",j.optString("backendId")).apply();cookie="";return true;
            }
        }catch(Exception ignored){}return false;
    }
    void rememberBackend() {
        try {
            HttpURLConnection c=(HttpURLConnection)new URL(companion()+"/health").openConnection();c.setConnectTimeout(2000);c.setReadTimeout(2000);
            try(InputStream in=c.getInputStream()){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[2048];int n;while((n=in.read(buf))!=-1)b.write(buf,0,n);
                JSONObject j=new JSONObject(b.toString("UTF-8"));prefs.edit().putString("backendId",j.optString("backendId")).apply();
            }finally{c.disconnect();}
        }catch(Exception ignored){}
    }
    void configure(String server, String password) {
        prefs.edit().putString("server", server.replaceAll("/+$", "")).putString("password", password).apply();
        cookie = "";
    }
    static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }
    synchronized void login() throws Exception {
        JSONObject body = new JSONObject().put("password", prefs.getString("password", ""));
        request("/api/auth", body, false);
        if (cookie.isEmpty()) throw new IOException("登录未成功，请检查访问密码");
    }
    JSONObject get(String path) throws Exception { return request(path, null, true); }
    JSONObject post(String path, JSONObject body) throws Exception { return request(path, body, true); }
    private JSONObject request(String path, JSONObject body, boolean retry) throws Exception {
        if (retry && cookie.isEmpty()) login();
        URL url = new URL((path.startsWith("/tv/")?companion():server()) + path);
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(25000);
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("User-Agent", UA);
        if (!cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
        try {
            if (body != null) {
                c.setRequestMethod("POST"); c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes("UTF-8")); }
            }
            int code = c.getResponseCode();
            if (code == 401 && retry) { cookie = ""; c.disconnect(); login(); return request(path, body, false); }
            InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (in != null) try (InputStream input = in) {
                byte[] buf = new byte[8192]; int n;
                while ((n = input.read(buf)) != -1) {
                    out.write(buf, 0, n);
                    if (out.size() > 8 * 1024 * 1024) throw new IOException("接口数据过大，请缩短搜索词");
                }
            }
            JSONObject result;
            try { result = new JSONObject(out.toString("UTF-8")); }
            catch (JSONException e) { throw new IOException("后台返回异常 HTTP " + code); }
            if (code >= 400) throw new IOException(result.optString("error", "HTTP " + code));
            String setCookie = c.getHeaderField("Set-Cookie");
            if (path.equals("/api/auth") && setCookie != null) cookie = setCookie.split(";", 2)[0];
            return result;
        } finally { c.disconnect(); }
    }
    String friendly(Exception e) {
        if (e instanceof SocketTimeoutException) return "连接超时：检查电脑后台与两台设备的网络";
        if (e instanceof ConnectException || e instanceof NoRouteToHostException) return "无法连接电脑：请先运行电脑上的启动LibreTV.cmd";
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
