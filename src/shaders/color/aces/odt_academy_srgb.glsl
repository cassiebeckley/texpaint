/*
# License Terms for Academy Color Encoding System Components #
https://github.com/ampas/aces-dev/blob/v1.0/LICENSE.md

Academy Color Encoding System (ACES) software and tools are provided by the
Academy under the following terms and conditions: A worldwide, royalty-free,
non-exclusive right to copy, modify, create derivatives, and use, in source and
binary forms, is hereby granted, subject to acceptance of this license.

Copyright (c) 2013 Academy of Motion Picture Arts and Sciences (A.M.P.A.S.).
Portions contributed by others as indicated. All rights reserved.

Performance of any of the aforementioned acts indicates acceptance to be bound
by the following terms and conditions:

* Copies of source code, in whole or in part, must retain the above copyright
notice, this list of conditions and the Disclaimer of Warranty.

* Use in binary form must retain the above copyright notice, this list of
conditions and the Disclaimer of Warranty in the documentation and/or other
materials provided with the distribution.

* Nothing in this license shall be deemed to grant any rights to trademarks,
copyrights, patents, trade secrets or any other intellectual property of
A.M.P.A.S. or any contributors, except as expressly stated herein.

* Neither the name "A.M.P.A.S." nor the name of any other contributors to this
software may be used to endorse or promote products derivative of or based on
this software without express prior written permission of A.M.P.A.S. or the
contributors, as appropriate.

This license shall be construed pursuant to the laws of the State of
California, and any disputes related thereto shall be subject to the
jurisdiction of the courts therein.

Disclaimer of Warranty: THIS SOFTWARE IS PROVIDED BY A.M.P.A.S. AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT ARE DISCLAIMED. IN NO EVENT SHALL A.M.P.A.S., OR ANY
CONTRIBUTORS OR DISTRIBUTORS, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, RESITUTIONARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE ACADEMY SPECIFICALLY
DISCLAIMS ANY REPRESENTATIONS OR WARRANTIES WHATSOEVER RELATED TO PATENT OR
OTHER INTELLECTUAL PROPERTY RIGHTS IN THE ACADEMY COLOR ENCODING SYSTEM, OR
APPLICATIONS THEREOF, HELD BY PARTIES OTHER THAN A.M.P.A.S.,WHETHER DISCLOSED OR
UNDISCLOSED.
*/

#pragma glslify: rgb_to_srgb = require('~/src/shaders/color/rgb_to_srgb')
#pragma glslify: log10 = require('~/src/shaders/color/aces/log10')
#pragma glslify: segmented_spline_c5_fwd = require(~/src/shaders/color/aces/segmented_spline_c5_fwd')
#pragma glslify: EPSILON = require('~/src/shaders/epsilon')
#pragma glslify: M = require(~/src/shaders/color/aces/monomial')

#pragma glslify: AP1_2_XYZ_MAT = require(~/src/shaders/color/aces/ap1_2_xyz_mat')
#pragma glslify: XYZ_2_AP1_MAT = require(~/src/shaders/color/aces/xyz_2_ap1_mat')
#pragma glslify: AP1_RGB2Y = require(~/src/shaders/color/aces/ap1_rgb2y')
#pragma glslify: AP0_2_AP1_MAT = require(~/src/shaders/color/aces/ap0_2_ap1_mat')
#pragma glslify: XYZ_2_AP0_MAT = require(~/src/shaders/color/aces/xyz_2_ap0_mat')
#pragma glslify: DISPLAY_PRI_2_XYZ = require(~/src/shaders/color/aces/display_pri_2_xyz')

precision mediump float;

#define PI 3.1415926538

float segmented_spline_c9_fwd(float x) {
    float coefsLow[10];    // coefs for B-spline between minPoint and midPoint (units of log luminance)
    coefsLow[0] = -1.6989700043;
    coefsLow[1] = -1.6989700043;
    coefsLow[2] = -1.4779000000;
    coefsLow[3] = -1.2291000000;
    coefsLow[4] = -0.8648000000;
    coefsLow[5] = -0.4480000000;
    coefsLow[6] =  0.0051800000;
    coefsLow[7] =  0.4511080334;
    coefsLow[8] =  0.9113744414;
    coefsLow[9] =  0.9113744414;

    float coefsHigh[10];   // coefs for B-spline between midPoint and maxPoint (units of log luminance)
    coefsHigh[0] = 0.5154386965;
    coefsHigh[1] = 0.8470437783;
    coefsHigh[2] = 1.1358000000;
    coefsHigh[3] = 1.3802000000;
    coefsHigh[4] = 1.5197000000;
    coefsHigh[5] = 1.5985000000;
    coefsHigh[6] = 1.6467000000;
    coefsHigh[7] = 1.6746091357;
    coefsHigh[8] = 1.6878733390;
    coefsHigh[9] = 1.6878733390;

    vec2 minPoint = vec2(segmented_spline_c5_fwd( 0.18*pow(2.,-6.5) ),  0.02); // {luminance, luminance} linear extension below this
    vec2 midPoint = vec2(segmented_spline_c5_fwd( 0.18 ),                4.8); // {luminance, luminance} 
    vec2 maxPoint = vec2(segmented_spline_c5_fwd( 0.18*pow(2.,6.5) ),   48.0); // {luminance, luminance} linear extension above this
    float slopeLow  = 0.0;       // log-log slope of low linear extension
    float slopeHigh = 0.04;      // log-log slope of high linear extension

    const int N_KNOTS_LOW = 8;
    const int N_KNOTS_HIGH = 8;

    // Check for negatives or zero before taking the log. If negative or zero,
    // set to EPSILON.
    float logx = log10(max(x, EPSILON)); 

    float logy;

    if ( logx <= log10(minPoint.x) ) { 
        logy = logx * slopeLow + ( log10(minPoint.y) - slopeLow * log10(minPoint.x) );
    } else if (( logx > log10(minPoint.x) ) && ( logx < log10(midPoint.x) )) {
        float knot_coord = float(N_KNOTS_LOW-1) * (logx-log10(minPoint.x))/(log10(midPoint.x)-log10(minPoint.x));
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec3 cf;
        if ( j <= 0) {
            cf = vec3(coefsLow[0],  coefsLow[1],  coefsLow[2]);
        } else if ( j == 1) {
            cf = vec3(coefsLow[1],  coefsLow[2],  coefsLow[3]);
        } else if ( j == 2) {
            cf = vec3(coefsLow[2],  coefsLow[3],  coefsLow[4]);
        } else if ( j == 3) {
            cf = vec3(coefsLow[3],  coefsLow[4],  coefsLow[5]);
        } else if ( j == 4) {
            cf = vec3(coefsLow[4],  coefsLow[5],  coefsLow[6]);
        } else if ( j == 5) {
            cf = vec3(coefsLow[5],  coefsLow[6],  coefsLow[7]);
        } else if ( j == 6) {
            cf = vec3(coefsLow[6],  coefsLow[7],  coefsLow[8]);
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);
    } else if (( logx >= log10(midPoint.x) ) && ( logx < log10(maxPoint.x) )) {

        float knot_coord = float(N_KNOTS_HIGH-1) * (logx-log10(midPoint.x))/(log10(maxPoint.x)-log10(midPoint.x));
        int j = int(knot_coord);
        float t = knot_coord - float(j);

        vec3 cf;
        if ( j <= 0) {
            cf = vec3(coefsHigh[0], coefsHigh[1], coefsHigh[2]);
        } else if ( j == 1) {
            cf = vec3(coefsHigh[1], coefsHigh[2], coefsHigh[3]);
        } else if ( j == 2) {
            cf = vec3(coefsHigh[2], coefsHigh[3], coefsHigh[4]);
        } else if ( j == 3) {
            cf = vec3(coefsHigh[3], coefsHigh[4], coefsHigh[5]);
        } else if ( j == 4) {
            cf = vec3(coefsHigh[4], coefsHigh[5], coefsHigh[6]);
        } else if ( j == 5) {
            cf = vec3(coefsHigh[5], coefsHigh[6], coefsHigh[7]);
        } else if ( j == 6) {
            cf = vec3(coefsHigh[6], coefsHigh[7], coefsHigh[8]);
        } 

        vec3 monomials = vec3( t * t, t, 1. );
        logy = dot(monomials, M * cf);
    } else { //if ( logIn >= log10(maxPoint.x) ) { 
        logy = logx * slopeHigh + ( log10(maxPoint.y) - slopeHigh * log10(maxPoint.x) );
    }

    return pow(logy, 10.0);
}

// Target white and black points for cinema system tonescale
const float CINEMA_WHITE = 48.0;
const float CINEMA_BLACK = 0.02; // CINEMA_WHITE / 2400.

float Y_2_linCV(float Y, float Ymax, float Ymin) 
{
    return (Y - Ymin) / (Ymax - Ymin);
}

// Transformations between CIE XYZ tristimulus values and CIE x,y 
// chromaticity coordinates
vec3 XYZ_2_xyY(vec3 XYZ)
{  
  vec3 xyY;
  float divisor = (XYZ.x + XYZ.y + XYZ.z);
  xyY.xy = XYZ.xy / max(divisor, 1e-10);
  xyY.z = XYZ.y;
  
  return xyY;
}

vec3 xyY_2_XYZ(vec3 xyY)
{
  vec3 XYZ;
  XYZ.x = xyY.x * xyY.z / max( xyY.y, 1e-10);
  XYZ.y = xyY.x;  
  XYZ.z = (1.0 - xyY[0] - xyY[1]) * xyY[2] / max( xyY[1], 1e-10);

  return XYZ;
}

// Gamma compensation factor
const float DIM_SURROUND_GAMMA = 0.9811;

vec3 darkSurround_to_dimSurround( vec3 linearCV)
{
  vec3 XYZ = AP1_2_XYZ_MAT * linearCV; 

  vec3 xyY = XYZ_2_xyY(XYZ);
  xyY.z = max(xyY.z, 0.);
  xyY.z = pow(xyY.z, DIM_SURROUND_GAMMA);
  XYZ = xyY_2_XYZ(xyY);

  return XYZ_2_AP1_MAT * XYZ;
}

// Saturation compensation factor
const float ODT_SAT_FACTOR = 0.93;
const mat3 ODT_SAT_MAT = mat3(
    vec3((1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[0] + ODT_SAT_FACTOR, (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[1], (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[2]),
    vec3((1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[0], (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[1] + ODT_SAT_FACTOR, (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[2]),
    vec3((1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[0], (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[1], (1.0 - ODT_SAT_FACTOR) * AP1_RGB2Y[2] + ODT_SAT_FACTOR)
);

const mat3 XYZ_2_DISPLAY_PRI_MAT = mat3(
    0.41239080, 0.21263901, 0.01933082,
    0.35758434, 0.71516868, 0.11919478,
    0.18048079, 0.07219232, 0.95053215
);

const vec2 AP0_WHITE = vec2(0.32168,  0.33767);
const vec2 REC709_PRI_WHITE = vec2(0.31270, 0.32900);

const mat3 CONE_RESP_MAT_BRADFORD = mat3(
     0.89510,  0.26640, -0.16140,
    -0.75020,  1.71350,  0.03670,
     0.03890, -0.06850,  1.02960
);

const mat3 INV_CONE_RESP_MAT_BRADFORD = mat3(
    0.98699291, -0.14705426,  0.15996265,
    0.43230527,  0.51836027,  0.04929123,
    -0.00852866,  0.04004282,  0.9684867
);

mat3 calculate_cat_matrix(
    vec2 src_xy,         // x,y chromaticity of source white
    vec2 des_xy          // x,y chromaticity of destination white
) {
    // Calculates and returns a 3x3 Von Kries chromatic adaptation transform 
    // from src_xy to des_xy using the cone response primaries defined 
    // by CONE_RESP_MAT_BRADFORD.

    vec3 src_xyY = vec3( src_xy.x, src_xy.y, 1. );
    vec3 des_xyY = vec3( des_xy.x, des_xy.y, 1. );

    vec3 src_XYZ = xyY_2_XYZ( src_xyY );
    vec3 des_XYZ = xyY_2_XYZ( des_xyY );

    vec3 src_coneResp = CONE_RESP_MAT_BRADFORD * src_XYZ;
    vec3 des_coneResp = CONE_RESP_MAT_BRADFORD * des_XYZ;

    mat3 vkMat = mat3(
        des_coneResp[0]/src_coneResp[0], 0.0, 0.0,
        0.0, des_coneResp[1]/src_coneResp[1], 0.0,
        0.0, 0.0, des_coneResp[2]/src_coneResp[2]
    );

    return (INV_CONE_RESP_MAT_BRADFORD * vkMat) * CONE_RESP_MAT_BRADFORD;
}

// const mat3 D60_2_D65_CAT = calculate_cat_matrix( AP0_WHITE, REC709_PRI_WHITE);

const mat3 D60_2_D65_CAT = mat3(
    1.0074907834951157, -0.006221569500961697, -0.013048924410388851,
    -0.030625260908988792, 0.9755641622789065, -0.000645225943184724,
    0.0005207330177655085, 0.00476541331512529, 1.0920586986267373
);

// const mat3 D60_2_D65_CAT = mat3(
//     0.987224, -0.00759836, 0.00307257,
//     -0.00611327, 1.00186, -0.00509595,
//     0.0159533, 0.00533002, 1.08168
// );

// Output Device Transform - RGB computer monitor
//
// Summary :
//  This transform is intended for mapping OCES onto a desktop computer monitor 
//  typical of those used in motion picture visual effects production. These 
//  monitors may occasionally be referred to as "sRGB" displays, however, the 
//  monitor for which this transform is designed does not exactly match the 
//  specifications in IEC 61966-2-1:1999.
// 
//  The assumed observer adapted white is D65, and the viewing environment is 
//  that of a dim surround. 
//
//  The monitor specified is intended to be more typical of those found in 
//  visual effects production.
//
// Device Primaries : 
//  Primaries are those specified in Rec. ITU-R BT.709
//  CIE 1931 chromaticities:  x         y         Y
//              Red:          0.64      0.33
//              Green:        0.3       0.6
//              Blue:         0.15      0.06
//              White:        0.3127    0.329     100 cd/m^2
//
// Display EOTF :
//  The reference electro-optical transfer function specified in 
//  IEC 61966-2-1:1999.
//  Note: This EOTF is *NOT* gamma 2.2
//
// Signal Range:
//    This transform outputs full range code values.
//
// Assumed observer adapted white point:
//         CIE 1931 chromaticities:    x            y
//                                     0.3127       0.329
//
// Viewing Environment:
//   This ODT has a compensation for viewing environment variables more typical 
//   of those associated with video mastering.
//
// Input is OCES
// Output is sRGB
vec3 ODT_Academy_sRGB(vec3 oces) {
    // OCES to RGB rendering space
    vec3 rgbPre = AP0_2_AP1_MAT * oces;

    // Apply the tonescale independently in rendering-space RGB
    vec3 rgbPost = vec3(
        segmented_spline_c9_fwd(rgbPre.r),
        segmented_spline_c9_fwd(rgbPre.g),
        segmented_spline_c9_fwd(rgbPre.b)
    );

    // Scale luminance to linear code value
    vec3 linearCV = vec3(
        Y_2_linCV(rgbPost.x, CINEMA_WHITE, CINEMA_BLACK),
        Y_2_linCV(rgbPost.y, CINEMA_WHITE, CINEMA_BLACK),
        Y_2_linCV(rgbPost.z, CINEMA_WHITE, CINEMA_BLACK)
    );

    // Apply gamma adjustment to compensate for dim surround
    linearCV = darkSurround_to_dimSurround(linearCV);

    // Apply desaturation to compensate for luminance difference
    linearCV = ODT_SAT_MAT * linearCV;

    // Convert to display primary encoding
    // Rendering space RGB to XYZ
    vec3 XYZ = AP1_2_XYZ_MAT * linearCV;

    // Apply CAT from ACES white point to assumed observer adapted white point
    XYZ = D60_2_D65_CAT * XYZ;

    // CIE XYZ to display primaries
    linearCV = XYZ_2_DISPLAY_PRI_MAT * XYZ;

    // Handle out-of-gamut values
    // Clip values < 0 or > 1 (i.e. projecting outside the display primaries)
    linearCV = clamp( linearCV, 0., 1.);

    // Encode linear code values with transfer function
    return rgb_to_srgb(linearCV);
}

#pragma glslify: export(ODT_Academy_sRGB)