"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Activity,
  MapPin,
  Camera,
  Zap,
  Clock,
  BarChart3,
  ArrowRight,
  Check,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">NodeFleet</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary-dark">Register</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Enterprise Device
              <span className="text-gradient-primary"> Fleet Management</span>
            </h1>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Control, monitor, and manage your ESP32 IoT device fleet in real-time.
              Track GPS locations, capture media, execute remote commands, and schedule automated tasks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-primary hover:bg-primary-dark w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 w-full sm:w-auto"
              >
                View Documentation
              </Button>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-2xl blur-3xl"></div>
            <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="h-12 bg-slate-800 rounded-lg animate-pulse-soft"></div>
                <div className="h-12 bg-slate-800 rounded-lg animate-pulse-soft" style={{ animationDelay: "0.2s" }}></div>
                <div className="h-12 bg-slate-800 rounded-lg animate-pulse-soft" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Powerful Features for Device Management
          </h2>
          <p className="text-xl text-slate-400">
            Everything you need to manage your IoT fleet efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature Card 1 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Real-Time Monitoring</h3>
            <p className="text-slate-400">
              Monitor device status, battery levels, signal strength, and CPU temperature in real-time dashboards.
            </p>
          </div>

          {/* Feature Card 2 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">GPS Tracking</h3>
            <p className="text-slate-400">
              Track device locations with GPS coordinates, view movement trails, and visualize fleet positions on maps.
            </p>
          </div>

          {/* Feature Card 3 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Media Capture</h3>
            <p className="text-slate-400">
              Capture photos, videos, and audio recordings from devices. Organize and manage your media library.
            </p>
          </div>

          {/* Feature Card 4 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Remote Commands</h3>
            <p className="text-slate-400">
              Send commands to devices instantly. Capture media, reboot, update firmware, and execute custom actions.
            </p>
          </div>

          {/* Feature Card 5 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Task Scheduling</h3>
            <p className="text-slate-400">
              Schedule automated tasks and commands across your fleet. Run on custom schedules with cron expressions.
            </p>
          </div>

          {/* Feature Card 6 */}
          <div className="group p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-primary/50 transition-all hover:bg-slate-900/80 hover:shadow-glow-primary cursor-pointer">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Analytics & Insights</h3>
            <p className="text-slate-400">
              Visualize device performance metrics, activity trends, and operational statistics with detailed charts.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-cyan-500/10 to-blue-500/10 border border-primary/20 rounded-2xl p-12 md:p-16">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary to-cyan-500 blur-3xl"></div>
          <div className="relative">
            <h2 className="text-4xl font-bold text-white mb-4 text-center">
              Ready to Manage Your Fleet?
            </h2>
            <p className="text-center text-slate-300 mb-8 text-lg">
              Start with a free account and manage up to 5 devices. Upgrade anytime as your fleet grows.
            </p>
            <div className="flex justify-center gap-4 flex-col sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="bg-primary hover:bg-primary-dark w-full sm:w-auto">
                  Create Free Account
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-500 text-white hover:bg-slate-800 w-full sm:w-auto"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-white">NodeFleet</span>
              </div>
              <p className="text-slate-400 text-sm">
                Enterprise device fleet management for IoT.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2024 NodeFleet. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
