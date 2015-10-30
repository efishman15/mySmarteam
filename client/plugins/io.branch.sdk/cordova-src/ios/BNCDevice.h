//
//  BNCSystemObserver.h
//  Branch-SDK
//
//  Created by Alex Austin on 6/5/14.
//  Copyright (c) 2014 Branch Metrics. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <Cordova/CDV.h>

@interface BNCDevice : CDVPlugin

- (void)getInstallData:(CDVInvokedUrlCommand *)command;
- (void)getOpenData:(CDVInvokedUrlCommand *)command;

+ (NSString *)getUniqueHardwareId:(BOOL *)isReal andIsDebug:(BOOL)debug;
+ (NSString *)getURIScheme;
+ (NSString *)getAppVersion;
+ (NSString *)getCarrier;
+ (NSString *)getBrand;
+ (NSString *)getModel;
+ (NSString *)getOS;
+ (NSString *)getOSVersion;
+ (NSNumber *)getScreenWidth;
+ (NSNumber *)getScreenHeight;
+ (NSNumber *)getUpdateState:(BOOL)updateState;
+ (NSString *)getDeviceName;
+ (BOOL)isSimulator;
+ (BOOL)adTrackingSafe;

@end
