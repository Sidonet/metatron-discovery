/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  ElementRef, EventEmitter,
  Injector,
  Input,
  NgZone,
  OnDestroy,
  OnInit, Output,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {
  ColorRange,
  UIChartColorByDimension,
  UIChartColorBySeries,
  UIChartColorByValue,
  UIOption
} from '../../common/component/chart/option/ui-option';
import {
  CellColorTarget,
  ChartColorList,
  ChartColorType,
  ChartType,
  ColorCustomMode,
  ColorRangeType,
  ShelveFieldType
} from '@common/component/chart/option/define/common';

import * as _ from 'lodash';
import {OptionGenerator} from '@common/component/chart/option/util/option-generator';
import {RangeSliderComponent} from '../component/analysis/slider/range-slider.component';
import {BaseOptionComponent} from './base-option.component';
import {UIChartColor} from '@common/component/chart/option/ui-option/ui-color';
import {ColorPickerComponent} from '@common/component/color-picker/color.picker.component';
import {Pivot} from '@domain/workbook/configurations/pivot';
import {GradationGeneratorComponent} from '@common/component/gradation/gradation-generator.component';
import {ColorOptionConverter} from '@common/component/chart/option/converter/color-option-converter';
import {FormatOptionConverter} from '@common/component/chart/option/converter/format-option-converter';
import {Field} from '@domain/workbook/configurations/field/field';
import UI = OptionGenerator.UI;

// 색상 타입 리스트
const colorTypeList: object[] = [
  {label: 'None', id: ChartColorType.SINGLE},
  {label: 'Series', id: ChartColorType.SERIES},
  {label: 'Dimension', id: ChartColorType.DIMENSION},
  {label: 'Measure', id: ChartColorType.MEASURE}
];

/**
 * color option component
 */
@Component({
  selector: 'color-option',
  templateUrl: './color-option.component.html',
  styles: ['.sys-inverted {transform: scaleX(-1);}']
})
export class ColorOptionComponent extends BaseOptionComponent implements OnInit, OnDestroy {

  // constructor
  constructor(protected elementRef: ElementRef,
              protected injector: Injector,
              private zone: NgZone) {

    super(elementRef, injector);
  }

  @Input('resultData')
  public set setResultData(resultData: object) {
    this.resultData = resultData;
    if (resultData && resultData['data'] && resultData['data']['info'] && this.uiOption) {
      const tmpInfo = resultData['data']['info'];
      const tmpValFormat = this.uiOption.valueFormat;
      const minValue = this.checkMinZero(tmpInfo['minValue'], tmpInfo['minValue']);
      this.minValue = FormatOptionConverter.getDecimalValue(minValue, tmpValFormat.decimal, tmpValFormat.useThousandsSep);
      this.maxValue = FormatOptionConverter.getDecimalValue(tmpInfo['maxValue'], tmpValFormat.decimal, tmpValFormat.useThousandsSep);
    }
  }

  @Input('uiOption')
  public set setUiOption(uiOption: UIOption) {

    // Set
    this.uiOption = uiOption;

    if( ChartType.LABEL === this.uiOption.type && !this.uiOption.color ) {
      this.uiOption.color = UI.Color.measureUIChartColor('SC1');
    }

    // only if fieldList doesn't exist
    if (!this.uiOption.fieldList || 0 === this.uiOption.fieldList.length) {

      this.uiOption.fieldList = this.setFieldList();
    }

    // only if ranges of 'color by measure' don't exist
    if (!this.uiOption.color['ranges'] && ChartColorType.MEASURE === this.uiOption.color.type) {

      const colorList = ChartColorList[this.uiOption.color['schema']] as any;

      // set range list
      this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], colorList);

      this.resultData['type'] = null;

      // only if gradations are empty, customMode is gradient type
    } else if (this.uiOption.color['customMode'] && ChartColorType.MEASURE === this.uiOption.color.type &&
      ColorCustomMode.GRADIENT === this.uiOption.color['customMode']) {

      this.changeDetect.detectChanges();

      if (!this.gradationComp.gradxObj) {
        const obj = this.gradationInit(this.uiOption.color['ranges'], true);

        if (obj) {
          this.uiOption.color['ranges'] = obj['ranges'];

          this.rangesViewList = this.uiOption.color['ranges'];
          this.uiOption.color['visualGradations'] = obj['visualGradations'];
        }
      }
    }

    setTimeout(() => {
      // set ranges for view
      this.rangesViewList = this.setRangeViewByDecimal(this.uiOption.color['ranges']);
    }, 100);

    // set min / max by decimal format
    if (this.uiOption.valueFormat && undefined !== this.uiOption.valueFormat.decimal) {
      const minValue = this.checkMinZero(this.uiOption.minValue, this.uiOption.minValue);

      this.minValue = FormatOptionConverter.getDecimalValue(minValue, this.uiOption.valueFormat.decimal, this.uiOption.valueFormat.useThousandsSep);
      this.maxValue = FormatOptionConverter.getDecimalValue(this.uiOption.maxValue, this.uiOption.valueFormat.decimal, this.uiOption.valueFormat.useThousandsSep);
    }

  }

  // selected item index in gradation list
  private gradationIndex: number;

  // 순차, 대비
  public measureText: string;

  // series, dimension color list
  public defaultColorList: object[] = [
    {index: 1, colorNum: 'SC1'},
    {index: 2, colorNum: 'SC2'},
    {index: 3, colorNum: 'SC3'},
    {index: 4, colorNum: 'SC4'},
    {index: 5, colorNum: 'SC5'},
    {index: 6, colorNum: 'SC6'},
    {index: 7, colorNum: 'SC7'},
    {index: 8, colorNum: 'SC8'},
    {index: 9, colorNum: 'SC9'}
  ];

  public measureColorList: object[] = [
    {index: 1, colorNum: 'VC1'},
    {index: 2, colorNum: 'VC2'},
    {index: 3, colorNum: 'VC3'},
    {index: 4, colorNum: 'VC4'},
    {index: 5, colorNum: 'VC5'},
    {index: 6, colorNum: 'VC6'},
    {index: 7, colorNum: 'VC7'}
  ];

  // measure 반전(value) color list
  public measureReverseColorList: object[] = [
    {index: 8, colorNum: 'VC8'},
    {index: 9, colorNum: 'VC9'},
    {index: 10, colorNum: 'VC10'},
    {index: 11, colorNum: 'VC11'},
    {index: 12, colorNum: 'VC12'},
    {index: 13, colorNum: 'VC13'},
    {index: 14, colorNum: 'VC14'},
    {index: 15, colorNum: 'VC15'},
    {index: 16, colorNum: 'VC16'},
    {index: 17, colorNum: 'VC17'},
    {index: 18, colorNum: 'VC18'},
    {index: 19, colorNum: 'VC19'}
  ];

  // selected default color
  public selectedDefaultColor: object = this.defaultColorList[0];

  // selected measure color
  public selectedMeasureColor: object = this.measureColorList[0];

  // show / hide setting for color picker
  public colorListFlag: boolean = false;

  // show / hide setting for color type list
  public colorTypeFlag: boolean = false;

  // colorRange Component
  @ViewChildren('colorChartSlider')
  public colorRangeComp: QueryList<RangeSliderComponent>;

  // color picker element
  @ViewChild('colorPicker')
  public colorPicker: ColorPickerComponent;

  // gradation component
  @ViewChild(GradationGeneratorComponent)
  public gradationComp: GradationGeneratorComponent;

  // currently seleted color range
  public currentRange: ColorRange;

  // color type list
  public colorRangeTypeList = [{
    name: this.translateService.instant('msg.page.chart.color.measure.new.range.type.default'),
    value: ColorCustomMode.SECTION
  },
    {
      name: this.translateService.instant('msg.page.chart.color.measure.new.range.type.gradient'),
      value: ColorCustomMode.GRADIENT
    }];

  // min / max
  public minValue: string;
  public maxValue: string;

  public availableRangeValue: string;

  // gradation seperate value
  public separateValue: number = 10;

  // range list for view
  public rangesViewList = [];

  public resultData: object;

  public isTemplateColorInverted: boolean = undefined;

  // pivot data
  @Input('pivot')
  public pivot: Pivot;

  @Output() // Change를 붙이면 해당 모델 변경시 자동 이벤트 발생
  public changePivotColor: EventEmitter<Pivot> = new EventEmitter();

  // Init
  public ngOnInit() {
    super.ngOnInit();
    console.log( 'pivot', this.pivot );
  }

  // Destroy
  public ngOnDestroy() {
    super.ngOnDestroy();
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Getter / Setter
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  public get isGridChart(): boolean {
    return this.uiOption && ChartType.GRID === this.uiOption.type;
  } // get - isGridChart

  public get isLabelChart(): boolean {
    return this.uiOption && ChartType.LABEL === this.uiOption.type;
  } // get - isLabelChart

  public get isSeriesColorType(): boolean {
    return this.uiOption && this.uiOption.color.type === ChartColorType.SERIES;
  } // get - isSeriesColorType

  public get isDimensionColorType(): boolean {
    return this.uiOption && this.uiOption.color.type == ChartColorType.DIMENSION;
  } // get - isDimensionColorType

  public get isMeasureColorType(): boolean {
    return this.uiOption && this.uiOption.color.type == ChartColorType.MEASURE;
  } // get - isMeasureColorType

  public get existPivotSettings(): boolean {
    return this.pivot && this.pivot.aggregations.some( aggr => !!aggr.color );
  } // get - existPivotSettings

  public get filteredPivotColors(): Field[] {
    return this.pivot && this.pivot.aggregations.filter( aggr => !!aggr.color );
  } // get - filteredPivotColors

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * colostListFlag 반대값 설정
   */
  public toggleColorList() {
    this.colorListFlag = !this.colorListFlag;
  }

  /**
   * change colorType
   * @param {string} typeId - color type (series(default), dimension)
   */
  public changeColorType(typeId: string) {

    // 컬러타입 변경시 color setting hide로 default 설정
    (this.uiOption.color as UIChartColorBySeries).settingUseFl = false;

    // 선택된 컬러타입 selected color type
    const selectedColorType = _.find(colorTypeList, (item) => {
      return item['id'] === typeId;
    });

    let schema;

    // when type is changed
    if (JSON.stringify(this.uiOption.color.type['id']) !== JSON.stringify(selectedColorType['id'])) {

      schema = ChartColorType.MEASURE === selectedColorType['id'] ? this.measureColorList[0]['colorNum'] : this.defaultColorList[0]['colorNum'];

      // color by measure의 ranges 리스트가 없는경우
      if (ChartColorType.MEASURE.toString() === typeId) {

        // set color ranges
        this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], ChartColorList[schema] as any);
      }
      // color by series mapping값 설정
      else if (ChartColorType.SERIES.toString() === typeId) {

        this.uiOption.color = this.setMapping();
      }

      // 그리드라면
      if (_.eq(this.uiOption.type, ChartType.GRID)) {

        schema = ChartColorType.MEASURE === selectedColorType['id'] ? this.measureColorList[0]['colorNum'] : [];

        // colorTarget이 비어있다면 기본값 세팅
        if (_.isUndefined(this.uiOption.color['colorTarget'])) {
          this.uiOption.color['colorTarget'] = CellColorTarget.TEXT;
        }
      }

      // 타입이 변경되지 않는경우
    } else {
      schema = (this.uiOption.color as UIChartColorByDimension).schema;
    }

    const colorOption = {
      type: selectedColorType['id'],
      showFl: this.uiOption.color['showFl'] // 라인차트일때 dimension show / hide 설정
    };

    // single일때에는 code값만 설정
    if ('single' === typeId) {

      colorOption['code'] = '';
      // color by single이 아닌경우에만 schema, colorTarget 설정
    } else {
      colorOption['schema'] = schema;
      colorOption['colorTarget'] = this.uiOption.color['colorTarget'];

      // color by series일때
      if ('series' === typeId) {
        colorOption['mapping'] = this.uiOption.color['mapping'];
        colorOption['mappingArray'] = this.uiOption.color['mappingArray'];

        // color by measure일때
      } else if ('measure' === typeId) {
        colorOption['ranges'] = this.uiOption.color['ranges'];
      }
    }

    // dimension인 경우
    if (typeId === ChartColorType.DIMENSION.toString()) {

      // targetField를 입력
      colorOption['targetField'] = _.last(this.uiOption.fieldList);

      if (ChartType.GAUGE === this.uiOption.type) {
        this.uiOption.legend.auto = false;
      }
    }

    // 해당 컬러타입으로 설정
    this.uiOption = (_.extend({}, this.uiOption, {
      color: colorOption,
      legend: this.uiOption.legend
    }) as UIOption);

    // update
    this.update();
  }

  /**
   * Color By Dimension - 기분 필드 변경
   */
  public colorByDimension(field: Field): void {

    // type이 dimension일때 선택된 dimension으로 컬러설정 변경
    this.uiOption = (_.extend({}, this.uiOption, {
      color: {
        type: ChartColorType.DIMENSION,
        schema: (this.uiOption.color as UIChartColorByDimension).schema,
        targetField: !field ? _.last(this.uiOption.fieldList) : field.name,
        showFl: this.uiOption.color['showFl'] // 라인차트일때 dimension show / hide 설정
      }
    }) as UIOption);

    // update
    this.update();
  }

  /**
   * 팔레트 색상을 변경한다
   */
  public changeColor(colorObj: object) {
    let color = _.cloneDeep(colorObj);

    // 차트 타입이 MEASURE인경우
    if (ChartColorType.MEASURE === this.uiOption.color.type) {

      // set color ranges
      this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], ChartColorList[color['colorNum']]);

      // 선택된 컬러를 변수에 설정
      if (_.eq(this.uiOption.type, ChartType.GRID)) {
        this.selectedMeasureColor = color;
        const gridColor = _.cloneDeep(colorObj);
        if ($('input#invertColor').is(':checked')) {
          gridColor['colorNum'] = 'R' + gridColor['colorNum'];
        }
        color = gridColor;
      }
    } else {

      // 선택된 컬러를 변수에 설정
      this.selectedDefaultColor = color;
    }

    // color by series일때 사용자 색상지정(mapping) 설정
    this.setUserCodes(color);

    // 해당 컬러색상으로 uiOption에 설정
    this.uiOption = (_.extend({}, this.uiOption, {
      color: {
        type: this.uiOption.color.type,
        schema: color['colorNum'],
        ranges: this.uiOption.color['ranges'],
        targetField: this.uiOption.color['targetField'],
        colorTarget: this.uiOption.color['colorTarget'],
        settingUseFl: (this.uiOption.color as UIChartColorBySeries).settingUseFl,
        showFl: this.uiOption.color['showFl'], // 라인차트일때 dimension show / hide 설정
        mapping: (this.uiOption.color as UIChartColorBySeries).mapping,
        mappingArray: (this.uiOption.color as UIChartColorBySeries).mappingArray
      }
    }) as UIOption);

    // update
    this.update();
  }

  public invertColor() {
    event.stopPropagation();

    this.isTemplateColorInverted = $('input#invertColor').is(':checked');

    let colorList: object[] = [];

    // measure color list 합치기
    colorList = colorList.concat(this.measureColorList);
    colorList = colorList.concat(this.measureReverseColorList);

    // 컬러리스트에서 같은 코드값을 가지는경우
    for (const item of colorList) {
      // 코드값이 같은경우
      if (this.uiOption.color['schema'].endsWith(item['colorNum'])) {
        this.changeColor(item);
      }
    }

  }

  public isChartColorInverted() {
    return this.uiOption.color['schema'].indexOf('R') === 0;
  }

  public isChartColorSelected(item) {
    return this.uiOption.color['schema'].endsWith(item['colorNum']);
  }

  /**
   * 타입이 series, diemnsion일때 코드값이 같은경우 해당 코드 리스트에서 index를 가져온다
   * @returns {any}
   */
  public checkDefaultSelectedColor(): number {

    // 컬러리스트에서 같은 코드값을 가지는경우
    for (const item of this.defaultColorList) {

      // 코드값이 같은경우
      if (JSON.stringify(this.uiOption.color['schema']) === JSON.stringify(item['colorNum'])) {

        return item['index'];
      }
    }
  }

  /**
   * 타입이 measure일때 코드값이 같은경우 해당 코드 리스트에서 index를 가져온다
   * @returns {any}
   */
  public checkMeasureSelectedColor(): any {

    let colorList: object[] = [];

    // measure color list 합치기
    colorList = colorList.concat(this.measureColorList);
    colorList = colorList.concat(this.measureReverseColorList);

    // 컬러리스트에서 같은 코드값을 가지는경우
    for (const item of colorList) {

      // 코드값이 같은경우
      if (this.uiOption.color['schema'].endsWith(item['colorNum'])) {

        return item['index'];
      }
    }
  }

  /**
   * 라인차트일때 교차의 dimension여부에 따라 color by dimension show hide 설정
   * @param _chartType
   */
  public lineChartCheck(_chartType: string): boolean {

    // // 라인차트이면서 showFl값이 false이면
    // if (String(ChartType.LINE) === chartType && !(<UIChartColorByDimension>this.uiOption.color).showFl) {
    //
    //   // false 리턴
    //   return false;
    // }
    return true;
  }

  /**
   * 사용자 색상설정 show
   */
  public showUserColorSet() {
    const colorObj: UIChartColorBySeries = this.uiOption.color as UIChartColorBySeries;
    // color setting show / hide 값 반대로 설정
    colorObj.settingUseFl = !colorObj.settingUseFl;
    // if( !colorObj.settingUseFl ) {
    //   const colorList = ChartColorList[colorObj.schema];
    //
    //   // 기존 컬러 리스트로 초기화
    //   const currColorMapObj = colorObj.mapping;
    //   const currColorMapList = colorObj.mappingArray;
    //   currColorMapList.forEach((item,idx) => {
    //     item['color'] = colorList[idx];
    //     (currColorMapObj[item['alias']]) && (currColorMapObj[item['alias']] = colorList[idx]);
    //   });
    //
    //   // 차트 업데이트
    //   this.uiOption.color = colorObj;
    //   this.update();
    // }
  }

  /**
   * 사용자 색상설정 초기화
   */
  public resetUserColorSet(item: any, index: number) {

    event.stopPropagation();

    const colorList = ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema];

    // 기존 컬러 리스트로 초기화
    (this.uiOption.color as UIChartColorBySeries).mapping[item.alias] = colorList[index];
    (this.uiOption.color as UIChartColorBySeries).mappingArray[index]['color'] = colorList[index];

    // userCodes값 설정에서 제거
    this.uiOption = (_.extend({}, this.uiOption, {
      color: {
        type: this.uiOption.color.type,
        schema: (this.uiOption.color as UIChartColorBySeries).schema,
        mapping: (this.uiOption.color as UIChartColorBySeries).mapping,
        mappingArray: (this.uiOption.color as UIChartColorBySeries).mappingArray,
        settingUseFl: (this.uiOption.color as UIChartColorBySeries).settingUseFl
      }
    }) as UIOption);

    // 차트 업데이트
    this.update();
  }

  /**
   * 컬러팔렛트의 색상을 선택시
   */
  public colorPaletteSelected(colorCode: string, item?: any) {

    // color by series일때
    if (this.uiOption.color.type === ChartColorType.SERIES) {
      // 선택된 필드의 index 가져오기
      const index = _.findIndex(this.uiOption.fieldMeasureList, {alias: item.alias});

      const color = ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema];

      // 해당 선택된 아이템이 있는경우
      if (-1 !== index) {

        // userCodes값이 없는경우 color codes값을 deep copy
        if (!(this.uiOption.color as UIChartColorBySeries).mapping) {
          (this.uiOption.color as UIChartColorBySeries).mapping = _.cloneDeep(color);
        }

        // mapping list에 변경된값 설정
        (this.uiOption.color as UIChartColorBySeries).mappingArray[index]['color'] = colorCode;

        // uiOption userCodes에 세팅
        (this.uiOption.color as UIChartColorBySeries).mapping[(this.uiOption.color as UIChartColorBySeries).mappingArray[index]['alias']] = colorCode;

        // 그리드라면
        if (_.eq(this.uiOption.type, ChartType.GRID)) {

          // colorTarget이 비어있다면 기본값 세팅
          if (_.isUndefined(this.uiOption.color['colorTarget'])) {
            this.uiOption.color['colorTarget'] = CellColorTarget.TEXT;
          }
        }

        this.uiOption = (_.extend({}, this.uiOption, {
          color: {
            type: this.uiOption.color.type,
            mapping: (this.uiOption.color as UIChartColorBySeries).mapping,
            mappingArray: (this.uiOption.color as UIChartColorBySeries).mappingArray,
            schema: (this.uiOption.color as UIChartColorBySeries).schema,
            settingUseFl: (this.uiOption.color as UIChartColorBySeries).settingUseFl,
            colorTarget: this.uiOption.color['colorTarget']
          }
        }) as UIOption);

        this.update();
      }
      // color by measure일때
    } else if (this.uiOption.color.type === ChartColorType.MEASURE) {

      const index = this.rangesViewList.findIndex(rangeItem => rangeItem.color === item.color);

      // 선택된 색상으로 설정
      (this.uiOption.color as UIChartColorByValue).ranges[index].color = colorCode;

      // 그리드라면
      if (_.eq(this.uiOption.type, ChartType.GRID)) {

        // colorTarget이 비어있다면 기본값 세팅
        if (_.isUndefined(this.uiOption.color['colorTarget'])) {
          this.uiOption.color['colorTarget'] = CellColorTarget.TEXT;
        }
      }

      this.uiOption = (_.extend({}, this.uiOption, {
        color: {
          type: this.uiOption.color.type,
          schema: (this.uiOption.color as UIChartColorBySeries).schema,
          ranges: (this.uiOption.color as UIChartColorByValue).ranges,
          customMode: (this.uiOption.color as UIChartColorByValue).customMode,
          colorTarget: this.uiOption.color['colorTarget']
        }
      }) as UIOption);

      // 선택된 필드 제거
      this.currentRange = null;

      this.update();
    }
  }

  /**
   * 새로운 색상범위 추가버튼클릭시
   */
  public addNewRange(index: number) {

    this.removeInputRangeStatus();

    // 색상 범위리스트
    const rangeList = (this.uiOption.color as UIChartColorByValue).ranges;

    // uiOption minValue의 range에 설정할값 양수일때에는 0, 음수일때에는 minValue로 설정
    const uiMinValue = this.uiOption.minValue >= 0 ? 0 : Math.floor(Number(this.uiOption.minValue) * (Math.pow(10, this.uiOption.valueFormat.decimal))) / Math.pow(10, this.uiOption.valueFormat.decimal);

    // 최대값
    const maxValue = rangeList[index - 1].gt;
    let minValue = rangeList[index].gt ? rangeList[index].gt : uiMinValue;

    // 현재 단계의 최소값 설정
    minValue = minValue + (maxValue - minValue) / 2;

    const formatMinValue = Math.floor(Number(minValue) * (Math.pow(10, this.uiOption.valueFormat.decimal))) / Math.pow(10, this.uiOption.valueFormat.decimal);
    const formatMaxValue = Math.floor(Number(maxValue) * (Math.pow(10, this.uiOption.valueFormat.decimal))) / Math.pow(10, this.uiOption.valueFormat.decimal);

    // 하위단계의 최대값 현재 최소값으로 변경
    rangeList[index].lte = formatMinValue;
    rangeList[index].fixMax = formatMinValue;

    const currentColor = rangeList[index].color;

    // 새로운 범위값 추가
    rangeList.splice(index, 0, UI.Range.colorRange(ColorRangeType.SECTION, currentColor, formatMinValue, formatMaxValue, formatMinValue, formatMaxValue));

    // default color range에 설정된 색상으로 색상, 범례 변경
    this.uiOption = (_.extend({}, this.uiOption, {
      color: {
        type: this.uiOption.color.type,
        schema: (this.uiOption.color as UIChartColorByValue).schema,
        ranges: rangeList,
        customMode: (this.uiOption.color as UIChartColorByValue).customMode,
        colorTarget: this.uiOption.color['colorTarget']
      }
    }) as UIOption);

    this.update();
  }

  /**
   * color range on / off 버튼 변경시
   */
  public changeColorRange() {

    let colorOption = this.uiOption.color as any;

    // custom color setting이 없을때
    if (!this.uiOption.color['customMode']) {

      colorOption['customMode'] = ColorCustomMode.SECTION;

      // ranges 값이 없는경우 uiOption update
      if (!(this.uiOption.color as UIChartColorByValue).ranges) {
        const ranges = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], ChartColorList[this.uiOption.color['schema']]);

        colorOption = {
          type: this.uiOption.color.type,
          schema: (this.uiOption.color as UIChartColorBySeries).schema,
          customMode: (this.uiOption.color as UIChartColorByValue).customMode,
          ranges: ranges
        };
      }
      // color range hide일때
    } else {
      // color by measure기본 ranges값으로 초기화
      const ranges = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema] as any);

      colorOption = {
        type: this.uiOption.color.type,
        schema: (this.uiOption.color as UIChartColorBySeries).schema,
        ranges: ranges
      };
    }

    // 그리드라면
    if (_.eq(this.uiOption.type, ChartType.GRID)) {

      // colorTarget이 비어있다면 기본값 세팅
      if (_.isUndefined(this.uiOption.color['colorTarget'])) {
        colorOption['colorTarget'] = CellColorTarget.TEXT;
      } else {
        colorOption['colorTarget'] = this.uiOption.color['colorTarget']
      }
    }

    this.uiOption = (_.extend({}, this.uiOption, {
      color: colorOption
    }) as UIOption);

    this.update();
  }

  /**
   * 선택된 컬러범위를 제거
   */
  public removeColorRange(_range: ColorRange, index: number) {

    // 색상 범위리스트
    const rangeList = (this.uiOption.color as UIChartColorByValue).ranges;

    // rangeList가 1개 남은경우 삭제불가
    if (1 === rangeList.length) return;

    const upperValue = rangeList[index - 1] ? rangeList[index - 1] : null;
    const lowerValue = rangeList[index + 1] ? rangeList[index + 1] : null;

    // 상위, 하위값 둘다있는경우
    if (upperValue && lowerValue) {
      // 상위범위 최대값
      const upperMaxValue = rangeList[index - 1].lte ? rangeList[index - 1].lte : rangeList[index - 1].gt;
      // 하위범위 최소값
      const lowerMinValue = rangeList[index + 1].gt ? rangeList[index + 1].gt : rangeList[index + 1].lte;

      // 삭제시 상위 최소값, 하위 최대값 자동변경값
      const autoChangeValue = Math.floor(Number((upperMaxValue + lowerMinValue) / 2) * (Math.pow(10, this.uiOption.valueFormat.decimal))) / Math.pow(10, this.uiOption.valueFormat.decimal);


      // 삭제된 상위값 최소값 변경
      rangeList[index - 1].gt = autoChangeValue;
      rangeList[index - 1].fixMin = autoChangeValue;
      // 삭제된 하위값 최대값 변경
      rangeList[index + 1].lte = autoChangeValue;
      rangeList[index + 1].fixMax = autoChangeValue;
    }

    // 리스트에서 선택된 컬러범위 제거
    rangeList.splice(index, 1);

    this.uiOption = (_.extend({}, this.uiOption, {color: this.uiOption.color}) as UIOption);

    this.update();

  }

  /**
   * 사용자 색상설정 타입 선택시
   */
  public selectColorRangeType(customMode: object): void {

    if (this.uiOption.color['customMode'] === customMode['value']) return;

    // 선택된 customMode 설정
    this.uiOption.color['customMode'] = customMode['value'];

    // case gradation
    if (ColorCustomMode.GRADIENT === customMode['value']) {
      delete this.uiOption.color['ranges'];
      delete this.uiOption.color['visualGradations'];
      // gradation range initialize
      const obj = this.gradationInit(this.uiOption.color['ranges'], true);

      this.uiOption.color['ranges'] = obj['ranges'];
      this.rangesViewList = this.uiOption.color['ranges'];
      this.uiOption.color['visualGradations'] = obj['visualGradations'];
      // section일때
    } else if (ColorCustomMode.SECTION === customMode['value']) {
      delete this.uiOption.color['ranges'];
      delete this.uiOption.color['visualGradations'];
      // range initialize
      this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], ChartColorList[this.uiOption.color['schema']] as any);
    }

    this.uiOption = (_.extend({}, this.uiOption, {color: this.uiOption.color}) as UIOption);

    this.update();
  }

  /**
   * 그라데이션 초기화설정
   */
  private gradationInit(gradations: object[], initFl?: boolean): object {

    const colorList = ChartColorList[this.uiOption.color['schema']];

    const minValue = this.checkMinZero(this.uiOption.minValue, parseInt(this.uiOption.minValue.toFixed(0), 10));
    const maxValue = parseInt(this.uiOption.maxValue.toFixed(0), 10);

    if (!gradations || gradations.length === 0) {
      gradations = [
        {
          color: colorList[0],
          position: -4,
          value: minValue
        },
        {
          color: colorList[colorList.length - 1],
          position: 215,
          value: maxValue
        }
      ];
    }

    const data: object = {
      min: minValue,
      max: maxValue,
      separateValue: this.separateValue,
      positionMin: -4,
      positionMax: 215
    };

    this.changeDetect.detectChanges();

    // gradation initialize
    const obj = this.gradationComp.init(gradations, data, initFl);

    // change emit이 안타는경우 type이 없을때 type값 설정
    if (initFl) obj['ranges'].forEach((item) => {
      if (!item['type']) {
        item['type'] = ColorRangeType.GRADIENT;
        return item
      } else {
        return item
      }
    });

    return obj;
  }

  /**
   * range min 입력값 수정시
   * @param range
   * @param index
   */
  public changeRangeMinInput(range: any, index: number): void {

    // number format regex
    const isNumber = this.isNumberRegex(range.gt);

    // 색상 범위리스트
    const rangeList = (this.uiOption.color as UIChartColorByValue).ranges;

    if (!range.gt || isNaN(FormatOptionConverter.getNumberValue(range.gt)) || isNumber === false) {
      // set original value
      range.gt = _.cloneDeep(FormatOptionConverter.getDecimalValue(rangeList[index].fixMin, this.uiOption.valueFormat.decimal, this.uiOption.valueFormat.useThousandsSep));
      return;
    }

    // parse string to value
    range = this.parseStrFloat(range);

    const decimalValue = this.uiOption.minValue;

    // uiOption minValue의 range에 설정할값 양수일때에는 0, 음수일때에는 minValue로 설정
    const uiMinValue = this.checkMinZero(this.uiOption.minValue, decimalValue);

    // 입력가능 최소 / 최대범위 구하기
    const minValue = rangeList[index + 1] ? rangeList[index + 1].gt ? rangeList[index + 1].gt : uiMinValue :
      rangeList[index].gt ? rangeList[index].gt : rangeList[index].lte;
    const maxValue = range.lte;

    // 최대값인경우 (변경불가)
    if (!rangeList[index - 1]) {

      // 최대값보다 큰거나 하위의 최대값보다 값이 작은경우
      if (this.uiOption.maxValue < range.gt || rangeList[index + 1].fixMax > range.gt) {
        range.gt = range.fixMin;
      } else {
        range.fixMin = range.gt;
      }
    }
    // 최소값이 입력가능범위를 벗어나는경우
    else if (minValue > range.gt || maxValue < range.gt) {

      // 기존값으로 리턴
      range.gt = range.fixMin;
    } else {
      range.fixMin = range.gt;
    }

    // 하위의 최대값에 같은값 입력
    if (rangeList[index + 1]) {

      rangeList[index + 1].lte = range.gt;
      rangeList[index + 1].fixMax = range.gt;
    }

    // set changed range in list
    rangeList[index] = range;

    this.uiOption = (_.extend({}, this.uiOption, {color: this.uiOption.color}) as UIOption);

    this.update();
  }

  /**
   * range max 입력값 수정시
   * @param range
   * @param index
   */
  public changeRangeMaxInput(range: any, index: number): void {

    // number format regex
    const isNumber = this.isNumberRegex(range.lte);

    // 색상 범위리스트
    const rangeList = (this.uiOption.color as UIChartColorByValue).ranges;

    if (!range.lte || isNaN(FormatOptionConverter.getNumberValue(range.lte)) || isNumber === false) {

      // set original value
      range.lte = _.cloneDeep(FormatOptionConverter.getDecimalValue(rangeList[index].fixMax, this.uiOption.valueFormat.decimal, this.uiOption.valueFormat.useThousandsSep));
      return;
    }

    // parse string to value
    range = this.parseStrFloat(range);

    // uiOption minValue의 range에 설정할값 양수일때에는 0, 음수일때에는 minValue로 설정
    const uiMinValue = this.checkMinZero(this.uiOption.minValue, this.uiOption.minValue);

    // 하위 fixMin값
    const lowerfixMin = rangeList[index + 1] ? (rangeList[index + 1].fixMin) ? rangeList[index + 1].fixMin : rangeList[index + 1].fixMax : null;

    // 최소값인경우
    if (!rangeList[index + 1]) {

      // 사용가능범위인경우
      if (uiMinValue < range.lte && rangeList[index - 1].fixMin > range.lte) {

        range.fixMax = range.lte;
        rangeList[index - 1].gt = range.lte;
      } else {
        // 기존값으로 리턴
        range.lte = range.fixMax;
      }
    }
    // 최대값이 입력가능범위를 벗어나는경우
    else if (range.fixMax < range.lte || (lowerfixMin > range.lte)) {

      // 기존값으로 리턴
      range.lte = range.fixMax;
    } else {
      range.fixMax = range.lte;
    }

    // 상위의 최대값에 같은값 입력
    if (rangeList[index - 1]) {

      rangeList[index - 1].fixMin = range.lte;
      rangeList[index - 1].gt = range.lte;
    }

    // 최소값이 현재 최대값보다 큰경우 최소값과 하위 최대값 변경
    if (null != range.fixMin && rangeList[index + 1] && range.fixMin > range.fixMax) {

      range.gt = range.fixMax;
      rangeList[index + 1].lte = range.fixMax;
      rangeList[index + 1].fixMax = range.fixMax;
    }

    // set changed range in list
    rangeList[index] = range;

    this.uiOption = (_.extend({}, this.uiOption, {color: this.uiOption.color}) as UIOption);

    this.update();
  }

  /**
   * color by measure)데이터에 맞게 색상 범위 균등분할
   */
  public equalColorRange(): void {

    // 색상 범위리스트
    const rangeList = (this.uiOption.color as UIChartColorByValue).ranges;

    const colorList = _.cloneDeep(ChartColorList[this.uiOption.color['schema']]) as any;

    // rangeList에서의 색상을 색상리스트에 설정
    rangeList.reverse().forEach((item, index) => {

      colorList[index] = item.color;
    });

    // set color ranges
    this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.resultData['data'], colorList, rangeList);

    this.uiOption = (_.extend({}, this.uiOption, {color: this.uiOption.color}) as UIOption);

    this.update();
  }

  /**
   * 입력 가능범위값 리턴
   */
  public availableRange(currentRnage: any, index: number): void {

    // color range list
    const rangeList = this.rangesViewList;

    let returnString: string = '';

    // case max value
    if (0 === index) {

      returnString += ': ' + currentRnage.fixMin;

      // case min value
    } else if (rangeList.length - 1 === index) {

      returnString += ': ' + currentRnage.fixMax;
    } else {

      // 하위값이 있는경우 하위값의 min값이 있는경우 min값으로 설정 없는경우 최소값 설정
      const availableMin = !rangeList[index + 1] ? null : rangeList[index + 1].fixMin ? rangeList[index + 1].fixMin : rangeList[index + 1].fixMax;
      const availableMax = currentRnage.fixMax;

      if (null !== availableMin) returnString += ': ' + availableMin.toString() + ' ~ ';
      if (null !== availableMax) returnString += availableMax.toString();
    }

    this.availableRangeValue = returnString;
  }

  /**
   * gauge color by dimension의 사용자 색상 설정시
   */
  public colorGaugePaletteSelected(colorCode: string, item?: any) {

    // 선택된 필드의 index 가져오기
    const index = _.findIndex(this.uiOption.fieldDimensionDataList, (data) => {
      return item.alias === data
    });

    const color = ChartColorList[(this.uiOption.color as UIChartColorByDimension).schema];

    // 해당 선택된 아이템이 있는경우
    if (-1 !== index) {

      // userCodes값이 없는경우 color codes값을 deep copy
      if (!(this.uiOption.color as UIChartColorByDimension).mapping) {
        (this.uiOption.color as UIChartColorByDimension).mapping = _.cloneDeep(color);
      }

      // mapping list에 변경된값 설정
      (this.uiOption.color as UIChartColorByDimension).mappingArray[index]['color'] = colorCode;

      // uiOption userCodes에 세팅
      (this.uiOption.color as UIChartColorByDimension).mapping[(this.uiOption.color as UIChartColorByDimension).mappingArray[index]['alias']] = colorCode;

      this.uiOption = (_.extend({}, this.uiOption, {
        color: {
          type: this.uiOption.color.type,
          mapping: (this.uiOption.color as UIChartColorByDimension).mapping,
          mappingArray: (this.uiOption.color as UIChartColorByDimension).mappingArray,
          schema: (this.uiOption.color as UIChartColorByDimension).schema,
          colorTarget: this.uiOption.color['colorTarget'],
          settingUseFl: (this.uiOption.color as UIChartColorBySeries).settingUseFl
        }
      }) as UIOption);

      this.update();
    }
  }

  /**
   * 사용자 색상설정 초기화
   */
  public resetGaugeUserColorSet(item: any, index: number) {

    event.stopPropagation();

    const colorList = ChartColorList[(this.uiOption.color as UIChartColorByDimension).schema];

    // 기존 컬러 리스트로 초기화
    (this.uiOption.color as UIChartColorByDimension).mapping[item.alias] = colorList[index];
    (this.uiOption.color as UIChartColorByDimension).mappingArray[index]['color'] = colorList[index];

    // userCodes값 설정에서 제거
    this.uiOption = (_.extend({}, this.uiOption, {
      color: {
        type: this.uiOption.color.type,
        schema: (this.uiOption.color as UIChartColorByDimension).schema,
        mapping: (this.uiOption.color as UIChartColorByDimension).mapping,
        mappingArray: (this.uiOption.color as UIChartColorByDimension).mappingArray,
        settingUseFl: (this.uiOption.color as UIChartColorByDimension).settingUseFl
      }
    }) as UIOption);

    // 차트 업데이트
    this.update();
  }

  /**
   * 변경된 gradation 리스트값 설정
   * @param {object} data
   */
  public changeGradations(data: object) {

    this.uiOption.color['visualGradations'] = data['visualGradations'];

    data['ranges'].forEach((item) => {
      if (!item.type) {
        item.type = ColorRangeType.GRADIENT;
        return item
      } else {
        return item
      }
    });

    if (JSON.stringify(data['ranges']) !== JSON.stringify(this.uiOption.color['ranges'])) {
      this.uiOption.color['ranges'] = data['ranges'];

      this.rangesViewList = this.uiOption.color['ranges'];
    }

    // binding된 데이터에 반영이 안되므로 zone run으로 실행
    this.zone.run(() => {
      this.uiOption = (_.extend({}, this.uiOption, {
        color: this.uiOption.color
      }) as UIOption);
    });

    // 화면에 추가된 리스트 반영
    this.changeDetect.detectChanges();

    this.$element.find('.ddp-box-color').find('.sp-replacer').removeClass('sp-active');
    // 같은 index번째의 리스트값에서 선택 클래스 설정
    this.$element.find('.ddp-box-color#ddp-box-color-' + data['currentSliderIndex']).find('.sp-replacer').addClass('sp-active');

    // update
    this.update();
  }

  /**
   * 그라데이션 색상의 범위를 추가
   */
  public addGradientRange(currentIndex: number) {

    // 첫번째 아이템이 아닌경우에만 현재 index의 앞의 index 설정
    currentIndex = 0 !== currentIndex ? currentIndex - 1 : 0;

    // 새로운 범위 추가
    this.gradationComp.addNewRangeIndex(currentIndex);
  }

  /**
   * 그라데이션 색상 범위 삭제
   */
  public deleteGradientRange(currentIndex: number) {

    // 리스트에서 선택된클래스 해제
    this.$element.find('.ddp-box-color').find('.sp-replacer').removeClass('sp-active');

    this.gradationComp.unselectSlider();

    this.gradationComp.deleteRange(currentIndex);
  }

  /**
   * 그라데이션의 리스트의 색상 변경시
   * @param colorStr
   * @param item
   */
  public gradationColorSelected(colorStr: string, item: any) {

    const rgbColor = this.setHextoRgb(colorStr);

    this.gradationComp.changeGradationColor(item.index, rgbColor);
  }

  /**
   * 그라데이션 색상을 클릭시 input박스에 값설정
   * @param item
   * @param index
   */
  public showGradationColor(item, index) {

    // 선택된 값이 있는경우 => input박스 height값만큼 color picker top위치 내려줌
    if (undefined === this.gradationIndex && undefined !== item.value) {
      const $container = $('.sp-container');
      let top = $container.not('.sp-hidden').offset().top;
      top += 30;
      $container.not('.sp-hidden').css({top: top});
    }

    // 현재 그라데이션 리스트에서 선택된 index
    this.gradationIndex = index;

    // 리스트에서의 선택클래스 해제
    this.$element.find('.ddp-box-color').not('#ddp-box-color-' + index).find('.sp-replacer').removeClass('sp-active');

    // gradation바의 선택클래스 해제
    this.gradationComp.unselectSlider(item.index);

  }

  /**
   * 그라데이션 색상팝업이 닫힐때 그라데이션슬라이더도 클릭해제
   * @param {number} index
   */
  public hideGradationColor(index?: number) {

    if (!$(event.target).attr('class')) return;

    // 그라데이션 슬라이더 선택시
    if (-1 !== $(event.target).attr('class').indexOf('gradx_slider')) {

      // 현재 그라데이션 리스트에서 선택된 index
      this.gradationIndex = undefined;

      // 인풋박스, 리스트, 추가버튼 선택이 아닐때
    } else if (-1 === $(event.target).attr('class').indexOf('ddp-input-txt') &&
      -1 === $(event.target).attr('class').indexOf('sp-preview-inner') &&
      -1 === $(event.target).attr('class').indexOf('ddp-icon-apply') &&
      -1 === $(event.target).attr('class').indexOf('ddp-list-blank')) {

      // 다른 선택된 클래스 제거
      this.$element.find('.ddp-box-color').find('.sp-replacer').removeClass('sp-active');

      // currentValue 화면에 반영
      this.changeDetect.detectChanges();

      this.gradationComp.unselectSlider();

      // 현재 그라데이션 리스트에서 선택된 index
      this.gradationIndex = undefined;

      // 인풋박스일때
    } else if (null !== index && -1 !== $(event.target).attr('class').indexOf('ddp-input-txt')) {
      // 선택해제된 클래스 재설정
      this.$element.find('#ddp-box-color-' + index + ' .sp-replacer').addClass('sp-active');
    }
  }

  /**
   * return color type
   * @param {string} type
   * @returns {string | any}
   */
  public returnColorType(type: string) {

    switch (type) {
      case ChartColorType.SINGLE.toString():
        return this.translateService.instant('msg.space.ui.none');
      case ChartColorType.SERIES.toString():
        return this.translateService.instant('msg.page.li.color.series');
      case ChartColorType.DIMENSION.toString():
        return this.translateService.instant('msg.page.li.color.dimension');
      case ChartColorType.MEASURE.toString():
        return this.translateService.instant('msg.page.li.color.measure');
    }
  }

  /**
   * return color by dimension column index
   * @returns {number}
   */
  public getDimensionIndex() {
    if (!this.uiOption.fielDimensionList) return;
    return _.findIndex(this.uiOption.fielDimensionList, {name: this.uiOption.color['targetField']});
  }

  /**
   * show / hide color min range span
   */
  public showMinInputColorRange(item, inputShow: boolean, minElement, index?: number) {

    event.stopPropagation();

    // hide other range preview
    this.removeInputRangeStatus();

    item['minInputShow'] = inputShow;

    if (undefined !== index) {
      // show input box
      this.changeDetect.detectChanges();
      this.availableRange(item, index);
      $(minElement).trigger('focus');
    }
  }

  /**
   * show / hide color max range span
   */
  public showMaxInputColorRange(item, inputShow: boolean, maxElement, index?: number) {

    event.stopPropagation();

    // hide other range preview
    this.removeInputRangeStatus();

    item['maxInputShow'] = inputShow;

    if (undefined !== index) {
      // show input box
      this.changeDetect.detectChanges();
      this.availableRange(item, index);
      $(maxElement).trigger('focus');
    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - Individual Color Settings
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 그라데이션 색상 변경
   * @param schemaInfo
   * @param target - 대상 필드
   */
  public changeGradationColor(schemaInfo: {index: number, colorNum: string}, target: Field): void {
    // {index: 8, colorNum: "VC8"}
    this.pivot.aggregations.forEach(aggr => {
      const aggrName = aggr.aggregationType + '(' + aggr.name + ')';
      const targetName = target.aggregationType + '(' + target.name + ')';
      if (aggrName === targetName) {
        aggr.color = {
          schema: {
            idx: schemaInfo.index,
            key: schemaInfo.colorNum
          }
        };
      }
    });
    this.changePivotColor.emit(this.pivot);
  } // func - changeGradationColor

  /**
   * 단색 변경
   * @param colorCode
   * @param target - 대상 필드
   */
  public changeSolidColor(colorCode:string, target: Field): void {
    this.pivot.aggregations.forEach(aggr => {
      const aggrName = aggr.aggregationType + '(' + aggr.name + ')';
      const targetName = target.aggregationType + '(' + target.name + ')';
      if (aggrName === targetName) {
        aggr.color.rgb = colorCode;
      }
    });
    this.changePivotColor.emit(this.pivot);
  } // func - changeSolidColor

  /**
   * 색상 필드 이름
   * @param target - 대상 필드
   */
  public getFieldName(target: Field): string {
    return target.aggregationType + '(' + target.name + ')';
  } // func - getFieldName

  /**
   * 반전 그라데이션 여부
   * @param target
   */
  public isInvertedSchema(target:Field): boolean {
    return target.color.schema.key.indexOf('R') === 0;
  } // func - isInvertedSchema

  /**
   * 단색 여부
   * @param target
   */
  public isSolid(target:Field): boolean {
    return !!target.color.rgb;
  } // func - isSolid

  /**
   * 그라데이션 여부
   * @param target
   */
  public isSchema(target:Field): boolean {
    return !!target.color.schema;
  } // func - isSchema

  /**
   * 개별 색상 설정 제거
   * @param target - 삭제 대상 필드
   */
  public removePivotColor(target: Field): void {
    this.pivot.aggregations.forEach(aggr => {
      const aggrName = aggr.aggregationType + '(' + aggr.name + ')';
      const targetName = target.aggregationType + '(' + target.name + ')';
      if (aggrName === targetName) {
        delete aggr.color;
      }
    });
    this.changePivotColor.emit(this.pivot);
  } // func - removePivotColor

  /**
   * 스키마 순번
   * @param target
   */
  public schemaIdx(target: Field): number {
    return target.color.schema.idx;
  } // func - schemaIdx

  /**
   * 스키마 Key
   * @param target
   */
  public schemaKey(target: Field): string {
    return target.color.schema.key;
  } // func - schemaKey

  /**
   * 단색 코드
   * @param target
   */
  public solidColorCode(target: Field): string {
    return target.color.rgb;
  } // func - solidColorCode

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * hex에서 rgb값으로 변경
   * @param color
   * @returns {string}
   */
  private setHextoRgb(color: string): string {

    color = _.cloneDeep(color.replace('#', ''));

    const rColor = parseInt(color.substring(0, 2), 16);
    const gColor = parseInt(color.substring(2, 4), 16);
    const bColor = parseInt(color.substring(4), 16);

    return 'rgb(' + rColor + ',' + gColor + ',' + bColor + ')';
  }

  /**
   * mapping, mappingArray값 설정
   * @param color
   * @returns {string[]}
   */
  private setUserCodes(color: object): object {

    // color by series가 아닐거나 mapping값이 없을때 return
    if ((!_.eq(ChartColorType.SERIES, this.uiOption.color.type) && !_.eq(ChartType.GAUGE, this.uiOption.type)) || (_.eq(ChartType.GAUGE, this.uiOption.type) && !_.eq(ChartColorType.DIMENSION, this.uiOption.color.type)) || !(this.uiOption.color as UIChartColorBySeries).mapping) return;

    // 기존 색상 리스트
    const colorList = ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema];
    (this.uiOption.color as UIChartColorBySeries).mappingArray.forEach((item, index) => {

      // 다른코드값이 아닌경우
      if (_.eq(colorList[index], item['color'])) {
        const changedColorList = ChartColorList[color['colorNum']];

        (this.uiOption.color as UIChartColorBySeries).mapping[item['alias']] = changedColorList[index];
        (this.uiOption.color as UIChartColorBySeries).mappingArray[index]['color'] = changedColorList[index];
      }
    });

    return (this.uiOption.color as UIChartColorBySeries);
  }

  /**
   * color의 mapping, mappingArray값 설정
   */
  private setMapping(): UIChartColor {

    let chartColorList = [];

    // VC가 포함되지 않은 리스트인경우 schema의 리스트값으로 설정
    if (-1 === (this.uiOption.color as UIChartColorBySeries).schema.indexOf('VC')) {

      chartColorList = ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema];

      // color by measure에 해당하는 리스트인경우 SC1리스트값으로 초기화
    } else {

      chartColorList = (ChartColorList['SC1'] as any);
    }

    if (!(this.uiOption.color as UIChartColorBySeries).mapping) (this.uiOption.color as UIChartColorBySeries).mapping = {};

    // color mapping값 설정
    if ((this.uiOption.color as UIChartColorBySeries).schema) {

      // mapping값이 제거된경우 이후 색상값을 초기화
      let colorChangedFl: boolean = false;

      // fieldMeasureList에서 제거된 값 제거
      for (const key in (this.uiOption.color as UIChartColorBySeries).mapping) {
        if (key) {
          const index = _.findIndex(this.uiOption.fieldMeasureList, {alias: key});

          // fieldMeasureList에서 없는 리스트이거나 이전의 값이 제거된경우 색상 초기화를 위해 제거
          if (-1 === index || colorChangedFl) {
            delete (this.uiOption.color as UIChartColorBySeries).mapping[key];
            colorChangedFl = true;
          }
        }
      }

      this.uiOption.fieldMeasureList.forEach((item, index) => {
        // 해당 alias값이 없을때에만 기본색상설정
        if ((this.uiOption.color as UIChartColorBySeries).schema && !(this.uiOption.color as UIChartColorBySeries).mapping[item.alias]) {
          (this.uiOption.color as UIChartColorBySeries).mapping[item.alias] = chartColorList[index];
        }
      });

      // mapping map array로 변경
      (this.uiOption.color as UIChartColorBySeries).mappingArray = [];

      Object.keys((this.uiOption.color as UIChartColorBySeries).mapping).forEach((key) => {

        (this.uiOption.color as UIChartColorBySeries).mappingArray.push({
          alias: key,
          color: (this.uiOption.color as UIChartColorBySeries).mapping[key]
        });
      });
    }

    return this.uiOption.color;
  }

  /**
   * fieldList값 리턴
   */
  private setFieldList(): string[] {

    const getShelveReturnString = ((shelve: any, typeList: ShelveFieldType[]): string[] => {
      const resultList: string[] = [];
      _.forEach(shelve, (_value, key) => {
        shelve[key].map((item) => {
          if (_.eq(item.type, typeList[0]) || _.eq(item.type, typeList[1])) {
            resultList.push(item.name);
          }
        });
      });
      return resultList;
    });

    return getShelveReturnString(this.pivot, [ShelveFieldType.DIMENSION, ShelveFieldType.TIMESTAMP]);
  }

  /**
   * set ranges for view
   * @param {ColorRange[]} ranges
   * @returns {any}
   */
  private setRangeViewByDecimal(ranges: ColorRange[]) {

    if (!ranges || 0 === ranges.length) return;
    // decimal null check
    const decimal = this.uiOption.valueFormat != null ? this.uiOption.valueFormat.decimal : 0;
    // decimal null check
    const commaUseFl = this.uiOption.valueFormat != null ? this.uiOption.valueFormat.useThousandsSep : false;

    const returnList: any = _.cloneDeep(ranges);

    for (const item of returnList) {
      item['fixMax'] = null === item.fixMax ? null : FormatOptionConverter.getDecimalValue(item.fixMax, decimal, commaUseFl) as any;
      item['fixMin'] = null === item.fixMin ? null : FormatOptionConverter.getDecimalValue(item.fixMin, decimal, commaUseFl) as any;
      item['gt'] = null === item.gt ? null : FormatOptionConverter.getDecimalValue(item.gt, decimal, commaUseFl) as any;
      item['lte'] = null === item.lte ? null : FormatOptionConverter.getDecimalValue(item.lte, decimal, commaUseFl) as any;
    }

    return returnList;
  }

  /**
   * parse string to float
   * @param range
   * @returns {any}
   */
  private parseStrFloat(range: any): any {

    range.fixMax = null === range.fixMax ? null : FormatOptionConverter.getNumberValue(range.fixMax);
    range.fixMin = null === range.fixMin ? null : FormatOptionConverter.getNumberValue(range.fixMin);
    range.gt = null === range.gt ? null : FormatOptionConverter.getNumberValue(range.gt);
    range.lte = null === range.lte ? null : FormatOptionConverter.getNumberValue(range.lte);
    return range;
  }

  /**
   * set minvalue zero by chart types
   * @param {number} minValue
   * @param {number} elseValue
   */
  private checkMinZero(minValue: number, elseValue: number) {

    let returnValue: number = elseValue;

    switch (this.uiOption.type) {

      // charts minvalue is zero
      case ChartType.BAR:
      case ChartType.LINE:
      case ChartType.SCATTER:
      case ChartType.BOXPLOT:
      case ChartType.COMBINE:
        if (minValue >= 0) returnValue = 0;
    }

    return returnValue;
  }

  /**
   * number validation regex
   * @param value
   */
  private isNumberRegex(value: any): boolean {
    // comma 빼기
    if (value.indexOf(',') !== -1) {
      value = value.replace(/,/g, '');
    }
    return !isNaN(Number(value));
  }

  private removeInputRangeStatus() {
    // hide other range preview
    _.each(this.rangesViewList, (rangeVal) => {
      if (rangeVal['minInputShow']) delete rangeVal['minInputShow'];
      if (rangeVal['maxInputShow']) delete rangeVal['maxInputShow'];
    });
    if (!_.isUndefined(this.uiOption.color['ranges']) && this.uiOption.color['ranges'].length > 0) {
      _.each(this.uiOption.color['ranges'], (uiRangeVal) => {
        if (uiRangeVal['minInputShow']) delete uiRangeVal['minInputShow'];
        if (uiRangeVal['maxInputShow']) delete uiRangeVal['maxInputShow'];
      });
    }
  }

}
